<template>
  <div class="chat-page">
    <div class="chat-container">
      <!-- 统计面板（放在聊天容器顶部） -->
      <div class="stats-panel">
        <div class="stat-item">
          总对话次数：<span>{{ stats.totalChats }}</span>
        </div>
        <div class="stat-item">
          首次使用：<span>{{
            new Date(stats.firstTimestamp).toISOString().slice(0, 10)
          }}</span>
        </div>
        <div class="stat-item">
          活跃天数：<span>{{ stats.activeDates.length }}</span> 天
        </div>
        <div class="stat-item">
          今日对话：<span>{{
            stats.dailyChats[new Date().toISOString().slice(0, 10)] || 0
          }}</span>
          次
        </div>
        <button class="detail-btn" @click="showModal = true">全部</button>
      </div>
      <div class="messages" ref="msgList">
        <transition-group name="msg" tag="div">
          <div
            v-for="msg in chatLog"
            :key="msg.id"
            :class="[
              'message',
              msg.role,
              { error: msg.isError, egg: msg.isEgg },
            ]"
          >
            <div class="avatar" :class="msg.role"></div>
            <div class="bubble">
              <div class="content" v-html="msg.text"></div>
            </div>
          </div>
          <div v-if="loading" class="message bot" key="loading">
            <div class="avatar bot"></div>
            <div class="bubble loading">
              正在思考中
              <span class="dots">
                <span class="dot">.</span>
                <span class="dot">.</span>
                <span class="dot">.</span>
              </span>
            </div>
          </div>
        </transition-group>
      </div>
      <form class="input-area" @submit.prevent="sendMessage">
        <!-- 输入框改成 textarea -->
        <textarea
          v-model="input"
          placeholder="向韩立提问…"
          :disabled="loading"
          @keydown="handleKeydown"
          rows="1"
        ></textarea>

        <!-- 清空按钮 -->
        <div class="btn-group">
          <button
            type="button"
            class="clear-btn"
            @click="clearChat"
            :disabled="loading"
            title="清空对话"
          >
            ✖
          </button>
        </div>

        <!-- 发送按钮 -->
        <button
          type="submit"
          class="send-btn"
          :disabled="!input.trim() || loading"
        >
          发送
        </button>

        <!-- 统计数据按钮 -->
        <button
          type="button"
          class="Alldetail-btn"
          @click="showModal = true"
          title="查看统计"
        >
          统计数据
        </button>
      </form>
    </div>

    <!-- 详细统计弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content">
        <h3>详细统计</h3>
        <ul class="detail-list">
          <li>总对话次数：{{ stats.totalChats }}</li>
          <li>
            首次使用：{{
              new Date(stats.firstTimestamp).toISOString().slice(0, 10)
            }}
          </li>
          <li>活跃天数：{{ stats.activeDates.length }} 天</li>
          <li>
            今日对话：{{
              stats.dailyChats[new Date().toISOString().slice(0, 10)] || 0
            }}
            次
          </li>
          <li>总使用时长：{{ formatDuration(stats.totalTime) }}</li>
          <li>当前连续活跃：{{ stats.currentStreak }} 天</li>
          <li>最长连续活跃：{{ stats.longestStreak }} 天</li>
          <li>
            最活跃日：{{ mostActiveDayComputed }} （{{
              stats.dailyChats[mostActiveDayComputed] || 0
            }}
            次）
          </li>
        </ul>
        <button class="close-btn" @click="showModal = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  reactive,
  ref,
  computed,
  onMounted,
  nextTick,
  watch,
  onBeforeUnmount,
} from "vue";
import { sendMessageToHui } from "@/api/deepseekApi";

const STORAGE_KEY = "hanLi_chat_log";

// 本地存储键名
const STORAGE_STATS_KEY = "hanli_chat_stats";
const showModal = ref(false);
// Stats 类型声明，确保所有字段都有默认值
interface Stats {
  firstTimestamp: number; // 首次使用时间戳
  totalChats: number; // 总对话次数
  activeDates: string[]; // 有发言的日期列表（yyyy‑mm‑dd）
  dailyChats: Record<string, number>; // 每日对话次数
  currentStreak: number; // 当前连续活跃天数
  longestStreak: number; // 历史最长连续活跃天数

  totalTime: number; // 累计使用时长（毫秒）
}

// 默认值，用于补齐本地存储中可能缺失的字段
const defaultStats: Stats = {
  firstTimestamp: Date.now(),
  totalChats: 0,
  activeDates: [],
  dailyChats: {},
  currentStreak: 0,
  longestStreak: 0,

  totalTime: 0,
};

// 从 localStorage 加载并合并默认值
function loadStats(): Stats {
  const saved = localStorage.getItem(STORAGE_STATS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return { ...defaultStats, ...parsed };
    } catch {
      console.warn("加载统计数据失败，使用默认值");
    }
  }
  return { ...defaultStats };
}

// 保存到 localStorage
function saveStats() {
  localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats));
}

// 更新「活跃天数」及「连续活跃」逻辑
function updateActive(date: string) {
  if (!stats.activeDates.includes(date)) {
    stats.activeDates.push(date);
    updateStreak();
    saveStats(); // 持久化活跃天数变化
  }
}
function updateStreak() {
  const dates = [...stats.activeDates].sort();
  let curr = 0,
    max = stats.longestStreak,
    prevTs = 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  dates.forEach((d) => {
    const ts = new Date(d).getTime();
    if (prevTs && ts - prevTs === 86400000) curr++;
    else curr = 1;
    max = Math.max(max, curr);
    prevTs = ts;
  });
  stats.currentStreak = dates[dates.length - 1] === todayStr ? curr : 0;
  stats.longestStreak = max;
  saveStats();
}

// 更新「每日对话次数」
function updateDaily(date: string) {
  stats.dailyChats[date] = (stats.dailyChats[date] || 0) + 1;
  saveStats(); // 持久化活跃天数变化
}

// 计算最活跃日
const mostActiveDayComputed = computed(() => {
  let day = "",
    max = 0;
  for (const [d, c] of Object.entries(stats.dailyChats)) {
    if (c > max) {
      max = c;
      day = d;
    }
  }
  return day || new Date().toISOString().slice(0, 10);
});

// 格式化总使用时长
function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} 小时 ${m} 分钟` : `${m} 分钟`;
}

// —— Vue 响应式状态 ——
const stats = reactive<Stats>(loadStats());
// 会话开始时间，用于计算本次时长
const sessionStart = Date.now();

interface ChatMsg {
  id: number;
  role: "user" | "bot";
  text: string;
  isError?: boolean;
  isEgg?: boolean;
}

const chatLog = ref<ChatMsg[]>(loadChatLog());
const input = ref("");
const loading = ref(false);
const msgList = ref<HTMLElement>();




async function sendMessage() {
  if (!input.value.trim()) return;
  if (stats.totalChats === 0 && !localStorage.getItem(STORAGE_STATS_KEY)) {
    stats.firstTimestamp = Date.now();
    saveStats();
  }
  const date = new Date().toISOString().slice(0, 10); // 每次都取最新“今天”
  stats.totalChats++;
  updateActive(date);
  updateDaily(date);
  saveStats();

  const userText = input.value;
  chatLog.value.push({
    id: Date.now(),
    role: "user",
    text: userText,
  });
  input.value = "";
  loading.value = true;

  try {
    //  throw new Error("测试错误");
    const history = chatLog.value.filter((msg) => !msg.isEgg && !msg.isError);
    const botReply = await sendMessageToHui(userText, history);
    if (botReply == "error") {
      chatLog.value.push({
        id: Date.now() + 2,
        role: "bot",
        text: "API余额耗尽了，去b站提醒我充钱吧",
        isError: true,
      });
    } else {
      chatLog.value.push({
        id: Date.now() + 1,
        role: "bot",
        text: botReply,
      }); 
    
    }
  } catch (e) {
    console.error(e);
   
  } finally {
    loading.value = false;
    await scrollToBottom();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") sendMessage();
}

function clearChat() {
  if (confirm("确定要清空全部对话吗？")) {
    chatLog.value = [
      {
        id: Date.now(),
        role: "bot",
        text: "你若愿说，我会听着。",
      },
    ];
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadChatLog(): ChatMsg[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("chatLog 解析失败：", e);
    }
  }
  return [
    {
      id: Date.now(),
      role: "bot",
      text: "你若愿说，我会听着。",
    },
  ];
}

async function scrollToBottom() {
  await nextTick();
  if (msgList.value) {
    msgList.value.scrollTop = msgList.value.scrollHeight;
  }
}

watch(
  chatLog,
  async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatLog.value));
    await scrollToBottom();
  },
  { deep: true }
);

function handleBeforeUnload() {
  stats.totalTime += Date.now() - sessionStart;
  saveStats();
}

onMounted(() => {
  scrollToBottom();
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<style scoped lang="scss">
/* 韩立风格 — 聊天页面（嵌套 SCSS，颜色写死） */
.chat-page {
  padding-top: 64px;
  min-height: 100vh;
  /* 暗玉夜色背景，衬托古纸卡片 */
  background: linear-gradient(180deg, #07100e 0%, #0b1a18 40%, #0f2b26 100%);
  color: #efe6d8;
  /* 页面次要文字古纸色（局部覆盖为墨色） */
  display: flex;
  flex-direction: column;
  font-family: "STKaiti", "KaiTi", "PingFang SC", "Noto Sans SC",
    "Helvetica Neue", Arial, sans-serif;

  .chat-container {
    flex: 1;
    width: 820px;
    margin: 0 auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;

    .stats-panel {
      display: flex;
      align-items: center;
      justify-content: space-around;
      background: linear-gradient(180deg, #efe6d8 0%, #efe1c0 100%);
      /* 古纸质感 */
      backdrop-filter: blur(3px);
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 14px;
      color: #2b2b27;
      /* 正文墨色 */
      box-shadow: 0 12px 30px rgba(2, 6, 5, 0.5);
      border: 1px solid rgba(11, 26, 24, 0.06);

      .stat-item {
        display: flex;
        align-items: center;

        .label {
          font-size: 12px;
          color: #6d6156;
          /* 暖棕 */
          margin-bottom: 4px;
          opacity: 0.95;
        }

        span {
          color: #d6b06a;
          /* 暖金数字 */
          font-weight: 700;
          font-size: 15px;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
        }
      }

      .detail-btn {
        background: transparent;
        border: 1px solid rgba(11, 26, 24, 0.1);
        border-radius: 6px;
        color: #6d6156;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.16s ease, box-shadow 0.16s ease,
          transform 0.12s;

        &:hover {
          background: rgba(214, 176, 106, 0.06);
          box-shadow: 0 8px 18px rgba(2, 6, 5, 0.18);
          transform: translateY(-2px);
        }

        &:active {
          transform: translateY(0);
        }

        &:focus-visible {
          outline: none;
          box-shadow: 0 0 0 6px rgba(214, 176, 106, 0.08);
        }
      }
    }
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 14px 0 120px;
    overscroll-behavior: contain;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }

  /* 单条消息风格（古纸卡片 + 墨色正文） */
  .message {
    display: flex;
    align-items: flex-start;
    margin-bottom: 14px;
    color: #2b2b27;
    /* 正文墨色 */

    &.user {
      flex-direction: row-reverse;
    }

    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      margin: 0 10px;
      background-size: cover;
      background-position: center;
      flex-shrink: 0;
      box-shadow: 0 8px 22px rgba(2, 6, 5, 0.42);
      z-index: 10;

      &.bot {
        background-image: url("@/assets/avatar.webp");
        border: 2px solid rgba(255, 255, 255, 0.06);
      }

      &.user {
        background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
        /* 符纸式头像 */
        border: 1px solid rgba(11, 26, 24, 0.06);
      }
    }

    .bubble {
      max-width: 78%;
      position: relative;
      background: linear-gradient(180deg, #fffaf0 0%, #f7efe0 100%);
      /* 古纸气质消息气泡 */
      border: 1px solid rgba(11, 26, 24, 0.06);
      backdrop-filter: blur(2px);
      padding: 14px 18px;
      border-radius: 14px;
      line-height: 1.65;
      word-break: break-word;
      box-shadow: 0 10px 28px rgba(2, 6, 5, 0.36);
      transition: box-shadow 0.18s, transform 0.12s, background 0.12s;
      color: #262622;
      /* 更深的墨色用于可读性 */

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 18px 44px rgba(2, 6, 5, 0.46),
          0 0 14px rgba(214, 176, 106, 0.04) inset;
      }

      &.loading {
        opacity: 0.95;
        color: rgba(38, 38, 34, 0.85);
      }

      /* bot 消息尾巴（左侧微角）*/
      .message.bot & {
        border-radius: 14px 14px 14px 6px;
        background: linear-gradient(135deg, #fffaf0 0%, #fff4e6 100%);
      }

      /* user 消息尾巴（右侧微角）*/
      .message.user & {
        border-radius: 14px 14px 6px 14px;
        background: linear-gradient(135deg, #fffaf0 0%, #fff7f2 100%);
      }

      .dots {
        display: inline-flex;
        align-items: center;
        margin-left: 6px;

        .dot {
          opacity: 0;
          font-size: 16px;
          animation: hanli-blink 1s infinite;

          &:nth-child(1) {
            animation-delay: 0s;
          }

          &:nth-child(2) {
            animation-delay: 0.18s;
          }

          &:nth-child(3) {
            animation-delay: 0.36s;
          }
        }

        @keyframes hanli-blink {
          0%,
          100% {
            opacity: 0;
            transform: translateY(0);
          }

          50% {
            opacity: 1;
            transform: translateY(-3px);
          }
        }
      }
    }

    /* 当为 error / egg 等修饰类时，给出不同语气色彩（仍保留古纸基底） */
    &.error .bubble {
      background: linear-gradient(
        180deg,
        rgba(245, 220, 220, 0.9) 0%,
        rgba(245, 210, 210, 0.95) 100%
      );
      border: 1px solid rgba(180, 110, 110, 0.14);
      box-shadow: 0 10px 30px rgba(180, 110, 110, 0.12);
    }

    &.egg .bubble {
      background: linear-gradient(
        180deg,
        rgba(255, 238, 240, 0.96) 0%,
        rgba(255, 245, 246, 0.98) 100%
      );
      border: 1px solid rgba(255, 200, 210, 0.14);
      box-shadow: 0 10px 30px rgba(255, 190, 200, 0.08);
    }
  }

  /* message 卡片内的 meta 信息（名字 / 时间 / 操作） */
  .message .message-meta {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;

    .left-meta {
      display: flex;
      gap: 12px;
      align-items: center;

      .name-avatar {
        width: 46px;
        height: 46px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        color: #0b0b0b;
        background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
        border: 1px solid rgba(11, 26, 24, 0.08);
        box-shadow: inset 0 -6px 12px rgba(226, 181, 120, 0.06);
        font-size: 16px;
      }

      .meta-texts {
        .message-name {
          font-size: 15px;
          color: #3a2c21;
          font-weight: 700;
          line-height: 1;
        }

        .message-time {
          font-size: 12px;
          color: #7b6a5d;
          margin-top: 2px;
        }
      }
    }

    .meta-actions {
      font-size: 14px;
      color: #b85a4f;
      display: flex;
      align-items: center;
      gap: 8px;

      .heart {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
        border: 1px solid rgba(11, 26, 24, 0.06);
        box-shadow: 0 6px 18px rgba(2, 6, 5, 0.08);
        cursor: pointer;
      }
    }
  }

  /* 输入区（改为古纸输入 + 暗玉主按钮） */
  .input-area {
    position: sticky;
    bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: linear-gradient(
      180deg,
      rgba(255, 250, 240, 0.98),
      rgba(250, 245, 235, 0.98)
    );
    backdrop-filter: blur(3px);
    padding: 10px;
    z-index: 30;
    border-radius: 14px;
    box-shadow: 0 14px 40px rgba(2, 6, 5, 0.36);
    border: 1px solid rgba(11, 26, 24, 0.06);

    textarea {
      flex: 1;
      padding: 10px 14px;
      background: linear-gradient(180deg, #fffaf0 0%, #f8efe0 100%);
      border: 1px solid #bfa887;
      color: #2b2b27;
      font-size: 15px;
      line-height: 1.45;
      outline: none;
      resize: none;
      overflow: hidden;
      min-height: 46px;
      max-height: 160px;
      border-radius: 12px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
      transition: border-color 0.16s, box-shadow 0.16s;

      &::placeholder {
        color: rgba(90, 63, 82, 0.35);
      }

      &:focus {
        border-color: #d6b06a;
        box-shadow: 0 0 10px rgba(214, 176, 106, 0.12);
      }
    }

    .btn-group {
      display: flex;
      gap: 8px;

      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: none;
        border-radius: 10px;
        background: linear-gradient(
          180deg,
          rgba(214, 176, 106, 0.06),
          rgba(214, 176, 106, 0.03)
        );
        color: #6d6156;
        cursor: pointer;
        transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
        box-shadow: 0 6px 16px rgba(2, 6, 5, 0.08);

        &:hover {
          transform: translateY(-3px);
          background: rgba(214, 176, 106, 0.08);
        }

        &:active {
          transform: translateY(0);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .clear-btn {
        font-size: 16px;
        line-height: 1;
      }
    }

    .send-btn {
      padding: 0 22px;
      height: 44px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #0f2b26 0%, #123a35 100%);
      /* 暗玉按钮 */
      color: #fff7ea;
      font-weight: 800;
      font-size: 15px;
      cursor: pointer;
      box-shadow: 0 14px 40px rgba(2, 6, 5, 0.5),
        inset 0 0 16px rgba(214, 176, 106, 0.04);
      transition: transform 0.14s, box-shadow 0.14s;

      &:hover:not(:disabled) {
        transform: translateY(-4px);
        box-shadow: 0 20px 48px rgba(2, 6, 5, 0.6),
          inset 0 0 22px rgba(214, 176, 106, 0.06);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        box-shadow: none;
        background: linear-gradient(180deg, #8f7d6f 0%, #7b6b60 100%);
        color: rgba(255, 247, 238, 0.8);
      }

      &:focus-visible {
        outline: none;
        box-shadow: 0 0 0 6px rgba(214, 176, 106, 0.08);
      }
    }

    .Alldetail-btn {
      display: none;
      margin-left: 4px;
      background: transparent;
      border: 1px solid rgba(11, 26, 24, 0.08);
      border-radius: 8px;
      padding: 6px 10px;
      color: #6d6156;
      font-size: 13px;
      cursor: pointer;

      &:hover {
        background: rgba(214, 176, 106, 0.06);
        box-shadow: 0 8px 18px rgba(2, 6, 5, 0.08);
      }
    }
  }

  /* 简洁模态框（古纸） */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(4, 8, 7, 0.78);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 18px;

    .modal-content {
      width: 360px;
      max-width: 100%;
      background: linear-gradient(180deg, #efe6d8 0%, #efe1c0 100%);
      backdrop-filter: blur(4px);
      border-radius: 14px;
      padding: 20px;
      color: #2b2b27;
      box-shadow: 0 18px 44px rgba(2, 6, 5, 0.46),
        inset 0 1px 0 rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(11, 26, 24, 0.06);
      animation: hanli-fade 240ms ease;
      position: relative;

      &::before {
        content: "印";
        position: absolute;
        left: 12px;
        top: 10px;
        font-size: 12px;
        padding: 4px 6px;
        border-radius: 6px;
        background: linear-gradient(180deg, #f7edd6 0%, #efe1c0 100%);
        color: #0b0b0b;
        border: 1px solid rgba(11, 26, 24, 0.08);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
      }

      h3 {
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: 700;
        text-align: center;
        color: #d6b06a;
        padding-bottom: 8px;
        border-bottom: 1px dashed rgba(214, 176, 106, 0.06);
      }

      .detail-list {
        margin: 12px 0 18px;
        list-style: none;
        padding: 0;
        line-height: 1.6;
        color: #2b2b27;
        font-size: 14px;

        li {
          margin-bottom: 8px;

          &:last-child {
            margin-bottom: 0;
          }
        }
      }

      .close-btn {
        display: block;
        margin: 0 auto;
        padding: 8px 20px;
        background: linear-gradient(135deg, #0f2b26 0%, #123a35 100%);
        color: #fff7ea;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 700;
        box-shadow: 0 12px 36px rgba(2, 6, 5, 0.5);
        transition: transform 0.12s ease, box-shadow 0.12s ease;

        &:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 44px rgba(2, 6, 5, 0.6);
        }

        &:active {
          transform: translateY(-1px) scale(0.998);
        }

        &:focus-visible {
          outline: none;
          box-shadow: 0 0 0 6px rgba(214, 176, 106, 0.08);
        }
      }
    }

    @keyframes hanli-fade {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.995);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  }

  /* 响应式：tablet / mobile */
  @media (max-width: 900px) {
    .chat-container {
      width: 100%;
      padding: 12px;

      .stats-panel {
        display: none;
      }
    }

    .messages {
      padding: 12px 8px 160px;
    }

    .message .avatar {
      width: 40px;
      height: 40px;
    }

    .message .bubble {
      max-width: 86%;
      padding: 12px 14px;
    }

    .input-area {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 12px;
      border-radius: 12px;
      textarea {
        width: 100%;
        min-height: 48px;
      }

      .btn-group {
        order: 2;
        justify-content: flex-end;
      }

      .send-btn {
        width: 100%;
        order: 3;
      }

      .Alldetail-btn {
        display: inline-flex;
      }
    }
  }
}
</style>
