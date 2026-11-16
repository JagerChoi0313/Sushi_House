<script>
export default {
  onLaunch() {
    if (!uni.getStorageSync('token')) {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  },
}
</script>

<style>
/* ——— 动效（第 6 条）———
   节奏参考麦当劳小程序那类快餐点单页：240–320ms、ease-out，位移小（8–14rpx），
   不用弹跳、不做长动画。小程序里 transform/opacity 走 GPU 合成，比改 top/height 省。 */
@keyframes lc-fade-up {
  from { opacity: 0; transform: translateY(14rpx); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lc-pop-in {
  0%   { opacity: 0; transform: scale(.94); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes lc-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: .62; }
}
/* 卡片进场：默认就用，任何页面加 .anim-card 即可 */
.anim-card { animation: lc-fade-up .28s ease-out both; }
.anim-pop  { animation: lc-pop-in .26s ease-out both; }
/* 审计 B7：原来是 1.1s infinite —— 一直闪的动画对阅读障碍与前庭敏感的人不友好，
   也没有任何关掉的入口。改成只闪 3 次（1.1s × 3 ≈ 3.3s）就停。 */
.anim-pulse { animation: lc-pulse 1.1s ease-in-out 3; }
/* 列表错开进场：给 .anim-list 下的直接子元素按序号加延迟（最多 8 项，再多不值当） */
.anim-list > view { animation: lc-fade-up .28s ease-out both; }
.anim-list > view:nth-child(1) { animation-delay: .02s; }
.anim-list > view:nth-child(2) { animation-delay: .06s; }
.anim-list > view:nth-child(3) { animation-delay: .10s; }
.anim-list > view:nth-child(4) { animation-delay: .14s; }
.anim-list > view:nth-child(5) { animation-delay: .18s; }
.anim-list > view:nth-child(6) { animation-delay: .22s; }
.anim-list > view:nth-child(7) { animation-delay: .26s; }
.anim-list > view:nth-child(8) { animation-delay: .30s; }

/* 审计 B7：系统开了「减弱动态效果」时全部关掉动画。
   微信小程序支持 @media (prefers-reduced-motion: reduce)，但基础库版本参差，
   所以再给一个显式的 .no-anim 类，用户可在「我的」页关掉（存 storage）。 */
@media (prefers-reduced-motion: reduce) {
  .anim-card, .anim-pop, .anim-pulse, .anim-list > view { animation: none !important; }
}
.no-anim .anim-card,
.no-anim .anim-pop,
.no-anim .anim-pulse,
.no-anim .anim-list > view { animation: none !important; }

page {
  background: #f5f6f8;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1f2329;
  font-size: 28rpx;
}
.page { padding: 24rpx; }
.card {
  background: #ffffff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(20, 24, 40, 0.04);
}
.row { display: flex; align-items: center; }
.between { justify-content: space-between; }
.wrap { flex-wrap: wrap; }
.flex1 { flex: 1; }
/* 审计 B5：次要文字原来 #8a8f99 在白底上只有 3.25:1，低于 WCAG AA 的 4.5:1。
   换成 #6b7280（约 5.0:1）；字号从 24rpx 提到 26rpx，微信建议正文不小于 24rpx。 */
.muted { color: #6b7280; font-size: 26rpx; }
.title { font-size: 32rpx; font-weight: 600; }
.section-title { font-size: 28rpx; font-weight: 600; margin: 6rpx 0 16rpx; }
.tag {
  display: inline-block;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: #f1f2f5;
  color: #5b6470;
  font-size: 22rpx;
  margin: 0 8rpx 8rpx 0;
}
.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 84rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 500;
}
.btn-primary { background: #c0392f; color: #ffffff; }
.btn-ghost { background: #ffffff; border: 1rpx solid #e3e6eb; color: #1f2329; }
.btn-sm {
  height: 60rpx;
  font-size: 24rpx;
  padding: 0 24rpx;
  border-radius: 12rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn[disabled] { opacity: 0.55; }
.input {
  background: #f7f8fa;
  border-radius: 14rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  height: 88rpx;
  box-sizing: border-box;
}
.input-area {
  background: #f7f8fa;
  border-radius: 14rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  width: 100%;
  box-sizing: border-box;
}
.divider { height: 1rpx; background: #eef0f3; margin: 20rpx 0; }
/* 审计 B5：#9aa0a8 在白底只有 2.64:1。空状态也要读得清。 */
.empty { text-align: center; color: #6b7280; padding: 60rpx 0; font-size: 26rpx; }
.pill {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
}
</style>
