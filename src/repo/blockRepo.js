module.exports = container => {
  const logger = container.resolve('logger')
  const { serverHelper } = container.resolve('config')
  const userKey = 'userInfo'
  const guestKey = 'guestInfo'
  const blockUser = async (uid) => {
    logger.d('blockUser uid', uid)
    await setUserData(uid, { isBlocked: 1 })
  }
  const setUserData = async (uid, obj) => {
    const user = await getUserInfo(uid)
    await redisHelper.hset(userKey, uid, JSON.stringify({ ...user, ...obj }))
    return getUserInfo(uid)
  }
  const getUserInfo = async (uid) => {
    try {
      const user = await redisHelper.hget(userKey, uid)
      return user ? JSON.parse(user) : {}
    } catch (e) {
      return {}
    }
  }
  const removeBlockUser = async (uid) => {
    logger.d('removeBlockUser uid', uid)
    await setUserData(uid, { isBlocked: 0 })
  }
  const kickSession = async (token) => {
    const { uid, name } = serverHelper.decodeToken(token)
    const hash = serverHelper.generateHash(token)
    const key = `kickUser-${uid}-${hash}`
    logger.d('kickSession uid', uid, name)
    await redisHelper.set(key, '1', '2d')
  }
  const kickSessionById = async (uid, hash) => {
    const key = `kickUser-${uid}-${hash}`
    await redisHelper.set(key, '1', '2d')
  }
  const getGuestInfo = async (deviceId) => {
    try {
      const guest = await redisHelper.hget(guestKey, deviceId)
      return guest ? JSON.parse(guest) : {}
    } catch (e) {
      return {}
    }
  }
  const setLanguageUser = (uid, langs) => {
    return setUserData(uid, { languages: langs })
  }

  return {
    blockUser,
    kickSession,
    removeBlockUser,
    kickSessionById,
    getUserInfo,
    getGuestInfo,
    setLanguageUser,
    setUserData
  }
}
