<template>
  <nav ref="navRef" class="navbar" :class="{ 'is-scrolled': isScrolled, 'is-open': open }" aria-label="主导航">
    <div class="navbar__container">
      <div class="online-count" v-if="onlineCount !== null">
        当前在线：<span class="count">{{ onlineCount }}人</span>
      </div>

      <button class="navbar__toggle" @click="toggle()" :aria-expanded="String(open)" aria-controls="primary-navigation"
        aria-label="切换导航">
        <span class="navbar__toggle-line" :class="{ 'open-1': open }"></span>
        <span class="navbar__toggle-line" :class="{ 'open-2': open }"></span>
        <span class="navbar__toggle-line" :class="{ 'open-3': open }"></span>
      </button>

      <ul id="primary-navigation" class="navbar__links" :class="{ 'is-open': open }" ref="linksRef" role="menubar">
        <li v-for="item in links" :key="item.name" role="none" @click="onLinkClick">
          <router-link :to="item.path" class="link" role="menuitem"
            :aria-current="isActive(item.path) ? 'page' : undefined">{{ item.name
            }}</router-link>
        </li>
      </ul>
    </div>

    <!-- 移动端展开时的遮罩，点击可关闭菜单 -->
    <div v-if="open" class="backdrop" @click="close()" aria-hidden="true"></div>
  </nav>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io } from "socket.io-client";

const siteId = "hui";
const onlineCount = ref<number | null>(null);
const socket = io("http://1.94.189.79:3000", { query: { siteId } });

const open = ref(false);
const isScrolled = ref(false);
const navRef = ref<HTMLElement | null>(null);
const linksRef = ref<HTMLElement | null>(null);

const links = ref([
  { name: '首页', path: '/' },
  { name: '传记', path: '/bio' },
  { name: '图集', path: '/gallery' },
  { name: '留言板', path: '/message' },
  { name: 'AI对话', path: '/talk' },
  { name: '网盘资源区', path: '/resources' }
]);

const route = useRoute();
const router = useRouter();

const handleScroll = () => {
  isScrolled.value = window.scrollY > 24;
};

const toggle = () => {
  open.value = !open.value;
};

const close = () => {
  open.value = false;
};

const onLinkClick = () => {
  open.value = false;
};

const isActive = (path: string) => {
  return route.path === path;
};

const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as Node;
  if (!open.value) return;
  if (navRef.value && !navRef.value.contains(target)) {
    close();
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && open.value) close();
};

onMounted(() => {
  window.addEventListener('scroll', handleScroll);
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
  socket.on("onlineCount", (count: number) => { onlineCount.value = count; });
});

watch(route, () => {
  open.value = false;
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});


</script>

<style lang="scss" scoped>
/* 主题色：玉青 / 纸色 / 暗金 */
$jade: #0f6b4b;
$paper: #f4efe4;
$ink: #222;
$gold: #c9a34a;

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1200;
  backdrop-filter: blur(6px);
  transition: box-shadow 0.28s ease, background 0.28s ease, transform 0.28s;
  background: linear-gradient(90deg, rgba(6, 8, 6, 0.72), rgba(12, 18, 14, 0.6));
  /* 使用 min-height 而不是固定 height，避免移动展开被裁切 */
  min-height: 64px;
  line-height: 64px;

  &.is-scrolled {
    box-shadow: 0 6px 20px rgba(5, 6, 5, 0.45);
    transform: translateY(-2px);
  }

  &__container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
  }

  .online-count {
    color: #7a6c6c;
    font-family: "Cinzel Decorative", serif;
    font-size: 1.05rem;

    .count {
      color: #a86670;
      font-weight: bold;
      text-shadow: 0 0 3px #a86670;
    }
  }


  &__toggle {
    display: none;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.03);
    align-items: center;
    justify-content: center;
    padding: 6px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .navbar__toggle-line {
      display: block;
      width: 18px;
      height: 2px;
      background: $paper;
      margin: 3px 0;
      transition: transform 0.28s ease, opacity 0.2s ease;
      transform-origin: center;
    }

    .open-1 {
      transform: translateY(5px) rotate(45deg);
    }

    .open-2 {
      opacity: 0;
    }

    .open-3 {
      transform: translateY(-5px) rotate(-45deg);
    }
  }

  &__links {
    display: flex;
    gap: 1.8rem;
    list-style: none;
    margin: 0;
    padding: 0;
    align-items: center;

    li {
      margin: 0;
    }

    a.link {
      color: $paper;
      text-decoration: none;
      font-weight: 500;
      position: relative;
      padding: 6px 0;
      transition: color 0.18s ease;

      &:hover {
        color: $jade;
      }

      &::after {
        content: '';
        position: absolute;
        left: 0;
        bottom: -6px;
        height: 3px;
        width: 0;
        background: linear-gradient(90deg, $gold, $jade);
        transition: width 0.28s cubic-bezier(.2, .9, .3, 1);
        border-radius: 2px;
        box-shadow: 0 2px 8px rgba(11, 40, 32, 0.25);
      }

      &:hover::after,
      &.router-link-active::after,
      &[aria-current='page']::after {
        width: 100%;
      }
    }

    /* small screens - 修复点：默认收起时 padding/opacity/pointer-events 都是“关闭”状态 */
    @media (max-width: 768px) {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: linear-gradient(180deg, rgba(8, 9, 7, 0.95), rgba(12, 16, 13, 0.96));
      flex-direction: column;
      gap: 0.5rem;
      transform-origin: top;
      max-height: 0;
      overflow: hidden;

      /* 关键：收起时移除 padding 并不可交互/不可见，避免留下黑色间隙 */
      padding: 0;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;

      transition:
        max-height 0.32s cubic-bezier(.2, .9, .3, 1),
        padding 0.2s,
        opacity 0.18s ease,
        visibility 0s linear 0.32s;
      /* visibility 延迟以配合过渡 */

      &.is-open {
        max-height: 360px;
        padding: 1rem 0;
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transition:
          max-height 0.32s cubic-bezier(.2, .9, .3, 1),
          padding 0.2s,
          opacity 0.18s ease,
          visibility 0s linear 0s;
      }

      a.link {
        display: block;
        font-size: 1.05rem;
        text-align: center;
        padding: 0.6rem 1rem;

        &::after {
          bottom: 8px;
        }
      }
    }
  }

  @media (max-width: 768px) {
    &__toggle {
      display: flex;
      flex-wrap: wrap;
      z-index: 1051;
    }
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1050;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.36), rgba(0, 0, 0, 0.54));
    backdrop-filter: blur(2px);
  }
}

/* 小屏幕时略微增加 nav 间距以便触控 */
@media (max-width: 480px) {
  .navbar {
    padding: 0.8rem 0;
    min-height: 56px;
    line-height: normal;
  }
}
</style>
