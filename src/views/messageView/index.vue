<template>
  <div class="megumi-message-board" aria-live="polite">
    <div class="threeDom" ref="threeRef"></div>

    <!-- 半透明顶部标题 -->
    <header class="board-header" role="banner">
      <div class="title-wrap">
        <h1>寒灯小筑</h1>
        <p class="subtitle">冷灯独坐，细说凡尘事</p>
      </div>
    </header>

    <!-- 留言展示区 -->
    <section class="message-list">
      <transition-group name="msg" tag="div" class="message-list-inner">
        <!-- skeleton loading -->
        <div v-if="loading" class="skeleton-wrap" key="skeleton">
          <div class="skeleton" v-for="i in 4" :key="i">
            <div class="sk-avatar"></div>
            <div class="sk-lines">
              <div class="sk-line short"></div>
              <div class="sk-line"></div>
            </div>
          </div>
        </div>

        <!-- messages -->
        <div v-for="(msg, idx) in messages" :key="msg.id || msg._tempId || idx" class="message-card" :data-index="idx"
          tabindex="0" role="article" :aria-label="`留言来自 ${msg.name || '匿名'}，内容：${msg.content}`">
          <div class="message-meta">
            <div class="left-meta">
              <div class="name-avatar" :title="msg.name || '匿名'">{{ getInitial(msg.name) }}</div>
              <div class="meta-texts">
                <div class="message-name">{{ msg.name || '匿名' }}</div>
                <div class="message-time">{{ formatTime(msg.created_at) }}</div>
              </div>
            </div>

          </div>

          <p class="message-content">{{ msg.content }}</p>
        </div>
      </transition-group>
    </section>

    <!-- 底部发送区 -->
    <section class="message-form" aria-label="写下你的留言">
      <label class="sr-only" for="mb-name">你的昵称</label>
      <input id="mb-name" v-model="name" type="text" placeholder="你的昵称" @keydown.enter.prevent />

      <label class="sr-only" for="mb-content">留言内容</label>
      <textarea id="mb-content" v-model="content" placeholder="写下你的留言..." @keydown.ctrl.enter.prevent="submitMessage"
        @input="autoGrow" ref="textareaRef" />

      <div class="form-row">
        <div class="hint">按 <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 快捷发送</div>
        <button @click="submitMessage" :disabled="isSending || !content.trim()"
          aria-disabled="isSending || !content.trim()">
          <span v-if="!isSending">发送</span>
          <span v-else>发送中…</span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue';
import { getMessageList, createMessage } from '@/api/modules/message';
import threeInit from './threeInit/threeBg';

const messages = ref<any[]>([]);
const name = ref(localStorage.getItem('megumi_name') || '');
const content = ref('');
const loading = ref(true);
const isSending = ref(false);


const textareaRef = ref<HTMLTextAreaElement | null>(null);

const fetchMessages = async () => {
  loading.value = true;
  try {
    const res = await getMessageList({ page: 1, pageSize: 9999 });
    messages.value = res.data || [];
    await nextTick();

  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const submitMessage = async () => {
  if (!content.value.trim() || isSending.value) return;
  isSending.value = true;
  const payload = { name: name.value || '匿名', content: content.value };
  try {
    localStorage.setItem('megumi_name', name.value);
    content.value = '';
    await nextTick();
    // 发送请求
    await createMessage(payload);
    // 重新同步列表（更可靠）
    await fetchMessages();
  } catch (err) {
    console.error(err);
  } finally {
    isSending.value = false;
  }
};

const formatTime = (time: string) => {
  if (!time) return '';
  const d = new Date(time);
  // 例如：2025-08-11 15:30
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
};

const getInitial = (n?: string) => {
  if (!n) return '惠';
  return n.trim().slice(0, 1).toUpperCase();
};



const autoGrow = (e?: Event) => {
  const ta = textareaRef.value;
  if (!ta) return;
  ta.style.height = 'auto';
  const h = Math.min(ta.scrollHeight, 220);
  ta.style.height = h + 'px';
};

const threeRef = ref<HTMLElement | null>(null);
let bgHandle: { cleanup?: () => void } | null = null;


onMounted(() => {
  fetchMessages();
  // ensure textarea autosize initial
  nextTick(() => autoGrow());
  bgHandle = threeInit(threeRef);
});
onBeforeUnmount(() => {
  if (bgHandle && typeof bgHandle.cleanup === 'function') {
    bgHandle.cleanup();
    bgHandle = null;
  }
});

</script>

<style scoped lang="scss">
/* 韩立风格留言板 —— 嵌套 SCSS，颜色写死，保留可访问性与交互 */
.megumi-message-board {
  position: relative;
  min-height: 100vh;
  padding-top: 92px;
  display: flex;
  flex-direction: column;
  /* 夜色底，衬出内层古纸 */
  font-family: "STKaiti", "KaiTi", "PingFang SC", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif;
  color: #efe6d8;
  /* 古纸文字色，页面主要文字可在局部覆盖为墨色 */
  overflow: hidden;

  .threeDom {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    width: 100%;
    height: 100%;
  }

  /* 半透明顶部标题（改为古纸牌匾风） */
  .board-header {
    position: absolute;
    top: 74px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 28px);
    max-width: 920px;
    background: linear-gradient(180deg, #efe6d8 0%, #efe1c0 100%);
    /* 古纸牌匾 */
    padding: 14px 18px;
    border-radius: 14px;
    box-shadow: 0 14px 40px rgba(2, 6, 5, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(4px);
    z-index: 20;
    border: 1px solid rgba(11, 26, 24, 0.06);

    .title-wrap {
      display: flex;
      align-items: center;
      gap: 14px;

      h1 {
        margin: 0;
        font-size: 20px;
        color: #3a2c21;
        /* 墨褐标题色 */
        letter-spacing: 0.6px;
        font-family: "STKaiti", "KaiTi", serif;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      }

      .subtitle {
        margin: 0;
        margin-left: auto;
        color: #6d6156;
        /* 暖棕副标题 */
        font-size: 13px;
      }
    }


  }

  /* 留言列表容器（内层古纸背景，滚动区） */
  .message-list {
    z-index: 10;
    position: relative;
    flex: 1;
    overflow-y: auto;
    padding: 32px 20px 260px;
    margin-top: 18px;

    /* 背景纸纹（极淡）*/
    &::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(circle at 20% 10%, rgba(11, 26, 24, 0.02) 0%, transparent 15%),
        linear-gradient(180deg, rgba(214, 176, 106, 0.02), rgba(214, 176, 106, 0.01));
      pointer-events: none;
      z-index: 9;
    }

    .message-list-inner {
      max-width: 920px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      z-index: 11;
    }

    /* skeleton（纸张色的骨架） */
    .skeleton-wrap {
      display: flex;
      flex-direction: column;
      gap: 12px;

      .skeleton {
        display: flex;
        gap: 12px;
        align-items: center;
        padding: 12px;
        background: linear-gradient(180deg, #efe6d8 0%, #efe1c0 100%);
        border-radius: 12px;
        box-shadow: 0 6px 18px rgba(2, 6, 5, 0.18);
        border: 1px solid rgba(11, 26, 24, 0.04);
      }

      .sk-avatar {
        width: 42px;
        height: 42px;
        border-radius: 8px;
        background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
        border: 1px solid rgba(11, 26, 24, 0.06);
      }

      .sk-lines {
        flex: 1;

        .sk-line {
          height: 10px;
          border-radius: 6px;
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.7), rgba(230, 220, 210, 0.7));
          margin-bottom: 8px;
        }

        .sk-line.short {
          width: 40%;
        }
      }
    }
  }

  /* 单条消息卡片（古纸卡片，带符章与墨印） */
  .message-card {
    background: linear-gradient(180deg, #fffaf0 0%, #f7efe0 100%);
    border-radius: 12px;
    padding: 14px;
    margin: 0 auto;
    width: calc(100% - 40px);
    max-width: 920px;
    box-shadow: 0 10px 30px rgba(2, 6, 5, 0.32);
    border: 1px solid rgba(11, 26, 24, 0.06);
    transition: transform 0.28s cubic-bezier(.2, .9, .2, 1), box-shadow 0.28s;
    transform-origin: center;
    z-index: 12;
    color: #2b2b27;

    &:hover {
      transform: translateY(-6px) scale(1.01);
      box-shadow: 0 18px 44px rgba(2, 6, 5, 0.46), 0 0 18px rgba(214, 176, 106, 0.06) inset;
    }



    .message-meta {
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
          /* 墨色文字 */
          background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
          /* 符纸底 */
          border: 1px solid rgba(11, 26, 24, 0.08);
          box-shadow: inset 0 -6px 12px rgba(226, 181, 120, 0.06);
          font-size: 16px;
        }

        .meta-texts {
          .message-name {
            font-size: 15px;
            color: #3a2c21;
            /* 墨褐 */
            font-weight: 700;
            line-height: 1;
          }

          .message-time {
            font-size: 12px;
            color: #7b6a5d;
            /* 暖棕时间 */
            margin-top: 2px;
          }
        }
      }


    }

    .message-content {
      font-size: 15px;
      color: #262622;
      /* 深墨正文 */
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      padding-bottom: 2px;
    }
  }

  /* transition-group 动画（消息淡入上移，节奏稍慢） */
  .msg-enter-from,
  .msg-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.995);
    filter: blur(0.6px);
  }

  .msg-enter-active,
  .msg-leave-active {
    transition: all 420ms cubic-bezier(0.2, 0.9, 0.2, 1);
  }

  /* 固定底部输入区 —— 改为暗玉按钮 + 古纸输入 */
  .message-form {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: 18px;
    width: calc(100% - 28px);
    max-width: 920px;
    background: linear-gradient(180deg, rgba(255, 250, 240, 0.98), rgba(250, 245, 235, 0.98));
    /* 稍浅古纸 */
    padding: 14px;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 14px 40px rgba(2, 6, 5, 0.32);
    z-index: 30;
    border: 1px solid rgba(11, 26, 24, 0.06);

    input,
    textarea {
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #bfa887;
      /* 暗金边 */
      font-size: 14px;
      outline: none;
      transition: box-shadow 0.18s, border-color 0.18s;
      background: linear-gradient(180deg, #fffaf0 0%, #f8efe0 100%);
      box-shadow: inset 0 -4px 8px rgba(234, 217, 180, 0.04);
      color: #2b2b27;
    }

    input:focus,
    textarea:focus {
      border-color: #d6b06a;
      /* 焦点金色 */
      box-shadow: 0 0 10px rgba(214, 176, 106, 0.12);
    }

    textarea {
      resize: none;
      min-height: 56px;
      max-height: 220px;
      line-height: 1.6;
    }

    .form-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;

      .hint {
        color: #6d6156;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;

        kbd {
          background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
          border-radius: 6px;
          padding: 2px 6px;
          border: 1px solid rgba(11, 26, 24, 0.06);
          box-shadow: inset 0 -2px 4px rgba(200, 180, 150, 0.04);
          font-size: 12px;
          color: #2b2b27;
        }
      }

      button {
        padding: 10px 16px;
        background: linear-gradient(135deg, #0f2b26 0%, #123a35 100%);
        /* 暗玉主按钮 */
        color: #fff7ea;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 800;
        box-shadow: 0 10px 30px rgba(2, 6, 5, 0.5), 0 0 18px rgba(214, 176, 106, 0.06) inset;
        transition: transform 0.16s, box-shadow 0.16s, opacity 0.12s;
        min-width: 110px;
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
        background: linear-gradient(180deg, #8f7d6f 0%, #7b6b60 100%);
        color: rgba(255, 247, 238, 0.8);
      }

      button:not(:disabled):active {
        transform: translateY(1px);
      }
    }
  }

  /* 小屏适配（嵌套写法）*/
  @media (max-width: 900px) {
    padding-top: 84px;

    .board-header {
      left: 12px;
      transform: none;
      width: calc(100% - 24px);

      &::before {
        display: none;
      }

      /* 移动端隐藏左侧装饰占位 */
    }

    .message-list {
      padding: 20px 14px 220px;

      .message-list-inner {
        gap: 12px;
      }

      .skeleton-wrap .skeleton {
        padding: 10px;
      }
    }

    .message-card {
      width: calc(100% - 28px);
      border-radius: 10px;
      padding: 12px;

      &::before {
        display: none;
      }

      .message-meta .left-meta .name-avatar {
        width: 40px;
        height: 40px;
      }
    }

    .message-form {
      left: 12px;
      transform: none;
      width: calc(100% - 24px);
      bottom: 12px;
      padding: 12px;
      border-radius: 12px;

      input,
      textarea {
        font-size: 14px;
        padding: 10px;
      }

      .form-row button {
        min-width: 90px;
      }
    }
  }

  /* 更小屏（手机） */
  @media (max-width: 420px) {
    padding-top: 76px;

    .board-header h1 {
      font-size: 18px;
    }

    .message-list {
      padding: 16px 12px 200px;
    }

    .message-card {
      padding: 10px;
    }

    .message-meta .left-meta .name-avatar {
      width: 36px;
      height: 36px;
      font-size: 14px;
    }

    .message-form {
      padding: 10px;
      bottom: 8px;
    }
  }

  /* 隐藏类名（可用于无障碍描述） */
  .sr-only {
    position: absolute !important;
    width: 1px !important;
    height: 1px !important;
    padding: 0 !important;
    margin: -1px !important;
    overflow: hidden !important;
    clip: rect(0, 0, 0, 0) !important;
    white-space: nowrap !important;
    border: 0 !important;
  }
}
</style>
