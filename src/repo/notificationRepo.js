module.exports = container => {
  const { schemas } = container.resolve('models')
  const { serverHelper } = container.resolve('config')
  const redisHelper = container.resolve('redisHelper')
  const { Notification } = schemas.mongoose
  const logger = container.resolve('logger')
  const getNotificationByUid = async (uid, limit, skip) => {
    const key = `getRewardHistoryByUid-${uid}-${limit}-${skip}`
    let awards = await redisHelper.get(key)
    if (awards) {
      awards = JSON.parse(awards)
      if (serverHelper.isTrustCacheData(awards)) {
        return awards.data
      } else {
        (Notification.find({ uid }).limit(limit).skip(skip).sort({ _id: -1 })).then(re => {
          redisHelper.set(key, JSON.stringify(serverHelper.handleDataBeforeCache(re)))
        }).catch(logger.e)
        return awards.data
      }
    }
    const re = await Notification.find({ uid }).limit(limit).skip(skip).sort({ _id: -1 })
    redisHelper.set(key, JSON.stringify(serverHelper.handleDataBeforeCache(re)))
    return re
  }
  return { getNotificationByUid }
}
