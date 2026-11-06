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
