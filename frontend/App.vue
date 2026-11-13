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
.anim-pulse { animation: lc-pulse 1.1s ease-in-out infinite; }
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
.muted { color: #8a8f99; font-size: 24rpx; }
.title { font-size: 32rpx; font-weight: 600; }
.section-title { font-size: 28rpx; font-weight: 600; margin: 6rpx 0 16rpx; }
.tag {
  display: inline-block;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background: #f1f2f5;
  color: #5b6470;
  font-size: 20rpx;
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
.btn-primary { background: #e64a45; color: #ffffff; }
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
.empty { text-align: center; color: #9aa0a8; padding: 60rpx 0; font-size: 26rpx; }
.pill {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  font-weight: 600;
}
</style>
