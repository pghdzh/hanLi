<template>
    <main class="home-simple" role="main" aria-labelledby="main-title">
        <div class="threeDom" ref="threeRef"></div>

        <div class="center">
            <h1 id="main-title" class="title">韩立 · 设定集</h1>
            <!-- 装饰性细线 -->
            <div class="title-divider" aria-hidden="true"></div>
            <h2 class="subtitle" aria-live="polite">
                <span class="subtitle__typed" ref="typedRef">{{ displayText }}</span>
                <span class="subtitle__cursor" aria-hidden="true"></span>
            </h2>

            <footer class="foot" role="contentinfo">
                <small>© {{ year }} 韩立设定集 · 凡人修仙 · 平凡不平庸</small>
            </footer>
        </div>
    </main>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, onBeforeUnmount } from 'vue';
import threeInit from './threeInit/threeBg';

const phrases = [
    '平凡中孕育锋芒。',
    '隐忍如常，步步为营。',
    '在暗处积累，终以静制动。',
    '以耐心换取机会，慢工生巧。',
    '表面平凡，内里深谋远虑。',
    '以小胜积累成大胜，逐步崛起。',
    '不言不争，却暗中布局。',
    '凡人一心，终登高位。'
];

// 放慢节奏以显从容
const TYPING_SPEED = 90; // 每字符打字 ms（变慢）
const DELETING_SPEED = 54; // 每字符删除 ms
const PAUSE_AFTER_FULL = 1600; // 打完后停顿 ms（更长）
const PAUSE_BEFORE_START = 600; // 每句开始前短暂停顿 ms

const displayText = ref('');
const typedRef = ref<HTMLElement | null>(null);
const year = new Date().getFullYear();

let phraseIndex = 0;
let charIndex = 0;
let deleting = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const prefersReduced = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

function startTypingLoop() {
    if (prefersReduced) {
        // 系统偏好减少动画：直接显示第一句（不循环）
        displayText.value = phrases[0];
        return;
    }

    const tick = () => {
        const current = phrases[phraseIndex % phrases.length];

        if (!deleting) {
            // typing
            charIndex++;
            displayText.value = current.slice(0, charIndex);

            if (charIndex >= current.length) {
                // 打完，停顿后开始删除
                timer = setTimeout(() => {
                    deleting = true;
                    tick();
                }, PAUSE_AFTER_FULL);
                return;
            } else {
                timer = setTimeout(tick, TYPING_SPEED);
            }
        } else {
            // deleting
            charIndex--;
            displayText.value = current.slice(0, charIndex);

            if (charIndex <= 0) {
                deleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                timer = setTimeout(tick, PAUSE_BEFORE_START);
                return;
            } else {
                timer = setTimeout(tick, DELETING_SPEED);
            }
        }
    };

    timer = setTimeout(tick, PAUSE_BEFORE_START);
}
const threeRef = ref<HTMLElement | null>(null);
let bgHandle: { cleanup?: () => void } | null = null;

onMounted(() => {
    bgHandle = threeInit(threeRef);
    startTypingLoop();
});

onUnmounted(() => {
    if (timer) clearTimeout(timer);
});

onBeforeUnmount(() => {
    if (bgHandle && typeof bgHandle.cleanup === 'function') {
        bgHandle.cleanup();
        bgHandle = null;
    }
});
</script>

<style lang="scss" scoped>
/* 更沉稳但不过于压抑的全页风格：深岩蓝 + 柔暖金 */
$bg-1: #041018;
/* 深海/岩石感 */
$bg-2: #08141a;
$title-col: #f7f5ee;
$muted-col: #d6cfbf;
$accent: #d4b35a;

.home-simple {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
   
    font-family: Inter, "Noto Sans SC", system-ui, -apple-system, "Segoe UI", Roboto, Arial;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    color: $title-col;
}

.threeDom {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
}

/* 居中容器（不是卡片，只用于布局） */
.center {
    width: 100%;
    max-width: 900px;
    text-align: center;
    padding: 0 1rem;
}

/* 标题 */
.title {
    margin: 0 0 0.55rem 0;
    font-size: clamp(1.9rem, 5.6vw, 3rem);
    font-weight: 700;
    color: $title-col;
    letter-spacing: 0.6px;
    text-rendering: optimizeLegibility;
    transform-origin: center;

    transform: translateY(6px);
    animation: enterUp 560ms cubic-bezier(.2, .9, .3, 1) 150ms both;
}

/* 细金色分割线 */
.title-divider {
    width: 45%;
    height: 2px;
    margin: 0.45rem auto 0.9rem;
    border-radius: 2px;
    background: linear-gradient(90deg, rgba($accent, 0.0), $accent, rgba($accent, 0.0));
    box-shadow: 0 1px 10px rgba(212, 179, 90, 0.08);

    transform: translateY(4px);
    animation: enterUp 560ms cubic-bezier(.2, .9, .3, 1) 230ms both;
}

/* 副标题与打字机 */
.subtitle {
    margin: 0.35rem 0 1.6rem;
    font-size: clamp(1rem, 2.4vw, 1.15rem);
    color: $muted-col;
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    justify-content: center;
    flex-wrap: wrap;
}

/* 静态前缀（“他是：”） */
.subtitle__static {
    opacity: 0.98;
    font-weight: 600;
    color: $title-col;
}

/* 打字文本 */
.subtitle__typed {
    min-width: 14ch;
    /* 保持宽度稳定，减少跳动 */
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Noto Sans Mono", monospace;
    font-weight: 500;
    color: $muted-col;
    letter-spacing: 0.2px;
}

/* 光标 */
.subtitle__cursor {
    display: inline-block;
    width: 10px;
    height: 1.08em;
    background: $accent;
    border-radius: 2px;
    margin-left: 6px;
    transform-origin: center;
    opacity: 1;
    animation: blink 1.1s steps(2, start) infinite;
}

/* 页脚 */
.foot {
    position: fixed;
    bottom: 0;
    left: 0;
    color: rgba($muted-col, 0.9);
    font-size: 0.86rem;
    opacity: 0.95;
    display: flex;
    justify-content: center;
    width: 100%;
    padding: 16px;
}

/* 动画优先级：尊重用户偏好 */
@media (prefers-reduced-motion: reduce) {
    .subtitle__cursor {
        animation: none;
        opacity: 0.9;
    }

    .subtitle__typed {
        transition: none !important;
    }
}

/* 光标闪烁 */
@keyframes blink {
    0% {
        opacity: 1;
    }

    50% {
        opacity: 0;
    }

    100% {
        opacity: 1;
    }
}

/* 桌面微调 */
@media (min-width: 900px) {
    .title {
        font-size: 3.2rem;
    }

    .subtitle {
        font-size: 1.18rem;
    }
}
</style>
