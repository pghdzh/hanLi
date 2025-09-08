<template>
    <div class="hanli-chat-page">
        <header class="topbar">
            <div class="title">凡人修仙</div>
            <div class="controls">
                <button class="btn" @click="clearMessages">清空对话</button>
                <button class="btn" @click="openPreset">自设角色</button>
            </div>
        </header>

        <!-- Self-setting Modal -->
        <div v-if="showPreset" class="preset-overlay" role="dialog" aria-modal="true">
            <div class="preset-modal">
                <h3>自设角色（OC）</h3>
                <form @submit.prevent="confirmPreset">
                    <label>
                        姓名
                        <input v-model="preset.name" type="text" placeholder="例如：柳木" />
                    </label>

                    <div class="row">

                        <label>
                            性别
                            <select v-model="preset.gender">
                                <option value="男">男</option>
                                <option value="女">女</option>
                                <option value="未知">未知</option>
                            </select>
                        </label>
                    </div>

                    <label>
                        出身
                        <input v-model="preset.birthplace" type="text" placeholder="例如：回龙镇孤儿" />
                    </label>

                    <div class="row">
                        <label>
                            灵根
                            <select v-model="preset.linggen">
                                <option value="天灵根">天灵根</option>
                                <option value="多灵根">多灵根</option>
                                <option value="杂灵根">杂灵根</option>
                                <option value="异灵根">异灵根</option>
                            </select>
                        </label>

                        <label>
                            专长
                            <input v-model="preset.special" type="text" placeholder="炼丹/阵法/机关/暗器..." />
                        </label>
                    </div>

                    <label>
                        性格简介
                        <input v-model="preset.trait" type="text" placeholder="例如：冷静、算计、隐忍" />
                    </label>

                    <div class="actions">
                        <button type="button" class="btn cancel" @click="closePreset">取消</button>
                        <button type="submit" class="btn primary">确认并应用</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Chat area -->
        <main class="chat-wrap">
            <div class="chat-window" ref="scrollRef" aria-live="polite">
                <div v-for="(m, i) in messages" :key="i" :class="['msg', m.role === 'user' ? 'user' : 'npc']">
                    <div class="avatar" :aria-hidden="true">{{ m.role === 'user' ? (userInitial || '我') : '世' }}</div>
                    <div class="bubble">
                        <div class="meta">{{ m.role === 'user' ? (preset.name || '我') : '世界意志' }}</div>
                        <div class="text">{{ m.text }}</div>
                        <div class="time">{{ m.time }}</div>
                    </div>
                </div>

                <div v-if="loading" class="msg npc loading">
                    <div class="avatar">世</div>
                    <div class="bubble">
                        <div class="meta">世界意志</div>
                        <div class="text">思索片刻，夜色如常。</div>
                        <span class="dots">
                            <span class="dot">.</span>
                            <span class="dot">.</span>
                            <span class="dot">.</span>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Input -->
            <footer class="input-area" @keydown.meta.enter.prevent="submitMessage">
                <textarea v-model="input" ref="ta" :placeholder="placeholderText"
                    @keydown.ctrl.enter.prevent="submitMessage" @input="autoGrow" rows="1"
                    :disabled="sending"></textarea>

                <div class="btns">
                    <button class="btn primary" :disabled="!canSend" @click="submitMessage" type="button">
                        {{ sending ? '发送中…' : '发送' }}
                    </button>
                </div>
            </footer>
        </main>
    </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from "vue";
/* 请根据实际项目路径调整导入 */
import { sendMessageToSystem } from "@/api/deepseekApi"; // ← 确保此路径与你工程一致
import { ElMessage } from "element-plus";
// 本组件内部类型与状态
const showPreset = ref(false);
const loading = ref(false);
const sending = ref(false);
const input = ref("");
const messages = ref([]); // { role: 'user'|'assistant'|'npc', text, time }
const scrollRef = ref(null);

// 预设表单（OC）
const preset = reactive({
    name: "",
    gender: "男",
    birthplace: "",
    linggen: "杂灵根",
    special: "",
    trait: "",
});

// 可读信息
const userInitial = computed(() => (preset.name ? preset.name.trim().slice(0, 1) : "我"));
const placeholderText = computed(() => {
    return preset.name ? `以“我”的身份发言（当前角色：${preset.name}）…按 Ctrl+Enter 发送` : "请先自设角色";
});

// 可发送判定：有内容且当前不在发送中
const canSend = computed(() => {
    return input.value.trim().length > 0 && !sending.value && messages.value.length > 1;
});


function buildHistory() {
    // 把 messages 最近若干条转换为 ChatMsg[] 形式
    return messages.value.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        text: m.text,
    }));
}

function clearMessages() {
    messages.value = [];
    input.value = "";
    localStorage.removeItem("storyMessages");
    ElMessage.success("已清空对话记录");
    pushMessage("assistant", "修仙一途，不进则退。若你愿以“我”之名加入此路，先自设角色以便引导。");
}

// UI 控制
function openPreset() {
    if (messages.value.length > 1) {
        return ElMessage.warning('自设人物前请先清空对话');
    }
    showPreset.value = true;
}
function closePreset() {
    showPreset.value = false;
}

// 确认自设：把自设内容以规定格式发给剧情引擎作为首条用户消息
async function confirmPreset() {
    showPreset.value = false;
    // 构造自然语言自设示例
    const selfText = `自设：姓名=${preset.name || "无名"}，性别=${preset.gender}，出身=${preset.birthplace || "未知"}，灵根=${preset.linggen}，专长=${preset.special || "无"}，性格=${preset.trait || "未明"}。`;
    // 记入界面
    pushMessage("user", selfText);
    await sendToSystem(selfText);
}



// push 消息到视图
function pushMessage(role, text) {
    const t = new Date();
    const time = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
    messages.value.push({ role: role === "user" ? "user" : "assistant", text, time });
    localStorage.setItem("storyMessages", JSON.stringify(messages.value));
    // 滚动到底
    nextTick(() => {
        try {
            const el = scrollRef.value;
            if (el) el.scrollTop = el.scrollHeight + 200;
        } catch (e) { }
    });
}

// 发送消息到后端剧情引擎
async function sendToSystem(userText) {
    sending.value = true;
    loading.value = true;
    try {
        const history = buildHistory();
        // 调用你的接口（会返回字符串）
        const reply = await sendMessageToSystem(userText, history);
        // 服务器端返回可能带有换行，做简单清理
        const cleaned = (reply || "").toString().trim();
        pushMessage("assistant", cleaned || "（空白回复）");
    } catch (e) {
        pushMessage("assistant", "（发生错误，无法联通剧情引擎）");
        console.error(e);
    } finally {
        sending.value = false;
        loading.value = false;
    }
}

// 发送用户当前输入
async function submitMessage() {
    const text = input.value.trim();
    if (!text || sending.value) return;
    // 如果用户未自设角色，仍允许以“我”发言，但提醒可先自设
    pushMessage("user", text);
    input.value = "";
    autoGrow();
    await sendToSystem(text);
}

// textarea 自动高度
const ta = ref(null);
function autoGrow() {
    const el = ta.value;
    if (!el) return;
    el.style.height = "auto";
    const h = Math.min(el.scrollHeight, 180);
    el.style.height = h + "px";
}

// 初始欢迎（可选）
onMounted(() => {
    // 初始提示短语（世界意志引导）
    const saved = localStorage.getItem("storyMessages");
    if (saved) {
        try {
            messages.value = JSON.parse(saved);
        } catch (e) {
            console.error("本地记录解析失败", e);
        }
    }
    if (messages.value.length == 0) {
        pushMessage("assistant", "修仙一途，不进则退。若你愿以“我”之名加入此路，先自设角色以便引导。");
    }

});
</script>

<style scoped lang="scss">
/* 韩立风格样式：颜色写死，嵌套 SCSS，已适配移动端 */
.hanli-chat-page {
    min-height: 100vh;
    padding: 18px;
    background: linear-gradient(180deg, #07100e 0%, #0f2b26 100%);
    /* 暗玉夜色 */
    font-family: "STKaiti", "KaiTi", "PingFang SC", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif;
    color: #efe6d8;
    /* 古纸色为基础文字（具体文本局部覆盖） */
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 80px;

    .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(180deg, #efe6d8 0%, #efe1c0 100%);
        /* 古纸牌匾 */
        padding: 10px 16px;
        border-radius: 12px;
        box-shadow: 0 12px 30px rgba(2, 6, 5, 0.6);
        border: 1px solid rgba(11, 26, 24, 0.06);
        color: #3a2c21;

        .title {
            font-size: 18px;
            font-weight: 700;
            font-family: "STKaiti", "KaiTi", serif;
        }

        .controls {
            .btn {
                padding: 8px 12px;
                border-radius: 8px;
                border: 1px solid rgba(11, 26, 24, 0.08);
                background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
                color: #2b2b27;
                cursor: pointer;
                font-weight: 600;
                box-shadow: 0 6px 18px rgba(2, 6, 5, 0.12);
            }
        }
    }

    .chat-wrap {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;

        .chat-window {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            border-radius: 12px;
            background: linear-gradient(180deg, rgba(239, 234, 220, 0.06), rgba(239, 234, 220, 0.02));
            border: 1px solid rgba(11, 26, 24, 0.03);
            box-shadow: inset 0 2px 8px rgba(11, 26, 24, 0.02);

            .msg {
                display: flex;
                gap: 10px;
                align-items: flex-start;
                margin-bottom: 12px;

                &.user {
                    flex-direction: row-reverse;

                    .bubble {
                        align-items: flex-end;
                        background: linear-gradient(180deg, #fffaf0 0%, #f7efe0 100%);
                        color: #262622;
                        border-radius: 14px 14px 6px 14px;
                    }

                    .avatar {
                        background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
                        color: #0b0b0b;
                        border: 1px solid rgba(11, 26, 24, 0.06);
                    }
                }

                &.npc {
                    .bubble {
                        background: linear-gradient(180deg, #fffaf0 0%, #fff4e6 100%);
                        color: #262622;
                        border-radius: 14px 14px 14px 6px;
                    }

                    .avatar {
                        background: linear-gradient(180deg, #efe6d8 0%, #efe1c0 100%);
                        color: #0b0b0b;
                    }
                }

                .avatar {
                    width: 46px;
                    height: 46px;
                    border-radius: 8px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    box-shadow: 0 8px 22px rgba(2, 6, 5, 0.36);
                    flex-shrink: 0;
                }

                .bubble {
                    max-width: 88%;
                    padding: 10px 14px;
                    box-shadow: 0 10px 28px rgba(2, 6, 5, 0.36);
                    border: 1px solid rgba(11, 26, 24, 0.06);

                    .meta {
                        font-size: 12px;
                        color: #6d6156;
                        margin-bottom: 6px;
                    }

                    .text {
                        white-space: pre-wrap;
                        line-height: 1.6;
                        font-size: 18px;
                        color: #262622;
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

                    .time {
                        margin-top: 8px;
                        font-size: 11px;
                        color: #7b6a5d;
                        text-align: right;
                    }
                }
            }
        }

        .input-area {
            position: sticky;
            bottom: 6px;
            display: flex;
            gap: 10px;
            align-items: flex-end;
            background: linear-gradient(180deg, rgba(255, 250, 240, 0.98), rgba(250, 245, 235, 0.98));
            padding: 10px;
            border-radius: 12px;
            border: 1px solid rgba(11, 26, 24, 0.06);
            box-shadow: 0 14px 40px rgba(2, 6, 5, 0.32);

            textarea {
                flex: 1;
                min-height: 44px;
                max-height: 180px;
                resize: none;
                padding: 8px 12px;
                border-radius: 10px;
                border: 1px solid #bfa887;
                background: linear-gradient(180deg, #fffaf0 0%, #f8efe0 100%);
                color: #2b2b27;
                font-size: 14px;
                line-height: 1.5;
                outline: none;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
            }

            .btns {
                display: flex;
                flex-direction: column;
                gap: 8px;

                .btn {
                    padding: 8px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(11, 26, 24, 0.06);
                    background: linear-gradient(180deg, #fff3d8 0%, #efe2c2 100%);
                    color: #2b2b27;
                    cursor: pointer;
                    font-weight: 700;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                    background: linear-gradient(180deg, #8f7d6f 0%, #7b6b60 100%);
                    color: rgba(255, 247, 238, 0.8);
                }

                .btn:not(:disabled):active {
                    transform: translateY(1px);
                }

                .primary {
                    background: linear-gradient(135deg, #0f2b26 0%, #123a35 100%);
                    color: #fff7ea;
                    box-shadow: 0 14px 40px rgba(2, 6, 5, 0.5), inset 0 0 16px rgba(214, 176, 106, 0.04);
                }

                .small {
                    padding: 6px 8px;
                    font-size: 13px;
                }
            }
        }
    }

    /* preset modal */
    .preset-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(4, 8, 7, 0.72);
        z-index: 80;

        .preset-modal {
            width: 520px;
            max-width: calc(100% - 40px);
            background: linear-gradient(180deg, #efe6d8 0%, #efe1c0 100%);
            padding: 18px;
            border-radius: 12px;
            border: 1px solid rgba(11, 26, 24, 0.06);
            box-shadow: 0 18px 44px rgba(2, 6, 5, 0.46);

            h3 {
                margin: 0 0 12px 0;
                color: #3a2c21;
                font-family: "STKaiti", "KaiTi", serif;
                font-size: 18px;
            }

            form {
                display: flex;
                flex-direction: column;
                gap: 10px;

                label {
                    display: flex;
                    flex-direction: column;
                    font-size: 13px;
                    color: #2b2b27;

                    input,
                    select {
                        margin-top: 6px;
                        padding: 8px 10px;
                        border-radius: 8px;
                        border: 1px solid rgba(11, 26, 24, 0.06);
                        background: #fffaf0;
                        font-size: 14px;
                        color: #2b2b27;
                    }
                }

                .row {
                    display: flex;
                    gap: 8px;

                    label {
                        flex: 1;
                    }
                }

                .actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 6px;

                    .btn {
                        padding: 8px 12px;
                        border-radius: 8px;
                        border: 1px solid rgba(11, 26, 24, 0.06);
                        cursor: pointer;
                    }

                    .cancel {
                        background: transparent;
                        color: #6d6156;
                    }
                }
            }
        }
    }

    /* responsiveness */
    @media (max-width: 900px) {
        padding: 12px;
        padding-top: 60px;


        .chat-wrap {
            .chat-window {
                padding: 10px;

                .msg .avatar {
                    display: none;
                }

            }

            .input-area {
                padding: 8px;
            }

            .preset-overlay .preset-modal {
                width: 92%;
            }
        }
    }


}
</style>
