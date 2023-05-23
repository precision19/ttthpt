module.exports = container => {
  const firebaseAdmin = container.resolve('firebaseAdmin')
  const i18n = container.resolve('i18n')
  const {
    userRepo,
    pingRepo,
    blockRepo,
    sessionRepo
  } = container.resolve('repo')
  const logger = container.resolve('logger')
  const { schemaValidator } = container.resolve('models')
  const mediator = container.resolve('mediator')
  const {
    httpCode,
    serverHelper,
    loginType,
    eventConfig,
    actionConfig
  } = container.resolve('config')
  const MAX_DEVICE = +process.env.MAX_DEVICE || 3
  const kickSessions = async (uid, sessions) => {
    if (sessions.length === 0) {
      return
    }
    await Promise.all(sessions.map(i => blockRepo.kickSessionById(i.uid, i.hash)))
    await sessionRepo.removeSession({ _id: { $in: sessions } })
  }
  const processLogin = async (obj) => {
    if (!obj.name && obj.fullname) {
      obj.name = obj.fullname
    }
    if (!obj.uid && obj.sub) obj.uid = obj.sub
    const {
      versionCode,
      fcmToken,
      name,
      deviceName,
      picture: avatar,
      auth_time: authTime,
      email,
      trustInfo,
      phone_number: phoneNumber,
      uid,
      deviceType,
      deviceId,
      username
    } = obj
    const sess = {
      uid,
      deviceType,
      deviceId,
      authTime,
      versionCode,
      deviceName
    }
    let token = ''
    let hash = ''
    let isLogin = false
    let userResponse
    const user = await userRepo.findOne({ uid }).lean()
    if (user) {
      if (user.isLocked) {
        return user
      }
      isLogin = true
      const update = {}
      if (name && !user.name) {
        update.name = name
        update.username = serverHelper.stringToSnakeCase(name)
      }
      if (avatar && !user.avatar) {
        update.avatar = avatar
      }
      userResponse = await userRepo.findOneAndUpdate({ uid }, {
        $set: {
          ...update,
          fcmToken
        }
      }, { useFindAndModify: false })
    } else {
      console.log('ccdm dang ky', obj)
      userResponse = await userRepo.createUser({
        avatar,
        name,
        username,
        email,
        provider: trustInfo.provider,
        method: trustInfo.method,
        phoneNumber,
        uid,
        fcmToken
      })
    }
    token = serverHelper.genToken({
      uid,
      fcmToken,
      deviceId,
      name,
      username,
      avatar,
      versionCode,
      deviceType,
      deviceName,
      loginType: loginType.USER
    })
    hash = serverHelper.generateHash(token)
    const sessions = await sessionRepo.getSessionNoPaging({ uid }, { _id: 1 })
    if (sessions.length >= MAX_DEVICE - 1) {
      const arr = []
      while (sessions.length > MAX_DEVICE - 1) {
        arr.push(sessions.shift())
      }
      console.log('.....................................kickSession webview ko bi loi')
      if (arr.length) {
        await kickSessions(uid, arr)
        console.log('logout ', name, uid, arr.length)
      }
    }
    const { exp } = serverHelper.decodeToken(token)
    sess.hash = hash
    sess.expireAt = exp
    await sessionRepo.createSession(sess)
    return {
      token,
      uid,
      isLogin,
      user: userResponse
    }
  }
  const checkLoginByDifferentMethod = async (oauthUser) => {
    if (oauthUser.email) {
      let old = await userRepo.findOne({ email: oauthUser.email })
      if (old) {
        old = old.toObject()
        if (old.provider !== oauthUser.trustInfo.provider) {
          return `Có vẻ như bạn đã đăng nhập bằng ${old.provider} với email ${old.email}, vui lòng tiếp tục với tài khoản ${old.provider} của bạn.`
        }
      }
    }
    return ''
  }
  const handleRefreshToken = async (token, uid) => {
    const hash = serverHelper.generateHash(token)
    const sess = await sessionRepo.findOne({
      uid,
      hash
    })
    if (sess) {
      const {
        expireAt,
        uid,
        deviceName,
        deviceId,
        deviceType,
        versionCode
      } = sess
      if (serverHelper.canRefreshToken(expireAt)) {
        const user = await userRepo.findOne({ uid })
        if (user) {
          const token = serverHelper.genToken({
            uid,
            deviceName,
            deviceId,
            versionCode,
            name: user.name,
            avatar: user.avatar,
            deviceType,
            loginType: loginType.USER
          })
          const hash = serverHelper.generateHash(token)
          const { exp } = serverHelper.decodeToken(token)
          sess.hash = hash
          sess.expireAt = exp
          sess.updateAt = Math.floor(Date.now() / 1000)
          sess.save()
          await sessionRepo.createSession(sess)
          return {
            ok: true,
            data: {
              token,
              uid
            }
          }
        } else {
          return {
            ok: false,
            data: { msg: i18n.re_login }
          }
        }
      } else {
        return {
          ok: false,
          data: { msg: i18n.re_login }
        }
      }
    } else {
      return {
        ok: false,
        data: { msg: i18n.session_not_found }
      }
    }
  }

  const verifyFirebase = async (body) => {
    try {
      const { token, method } = body
      const decodeUser = await firebaseAdmin.auth().verifyIdToken(token.trim())
      // const {}
      decodeUser.trustInfo = {
        method, provider: decodeUser.firebase.sign_in_provider
      }
      decodeUser.thirdPartyData = decodeUser.firebase
      return { data: decodeUser }
    } catch (e) {
      return { msg: e.message }
    }
  }
  const loginOrRegister = async (req, res) => {
    try {
      const {
        error,
        value
      } = schemaValidator(req.body, 'Login')
      if (error) {
        return res.status(httpCode.BAD_REQUEST).json({
          ok: false,
          msg: error.toString()
        })
      }
      const {
        token,
        method,
        code,
        domain
      } = value
      const { data: decodeUser, msg } = await verifyFirebase({ token, method, code, domain })
      console.log('decodeUser&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&', decodeUser)
      if (msg) {
        return res.status(httpCode.BAD_REQUEST).json({ msg })
      }
      if (+process.env.DEBUG_USER_LOGIN) {
        logger.d('User logged in', decodeUser)
      }
      const msgOldEmail = await checkLoginByDifferentMethod(decodeUser)
      if (msgOldEmail) {
        return res.status(httpCode.BAD_REQUEST).json({ msg: msgOldEmail })
      }
      const user = await processLogin({ ...value, ...decodeUser })
      if (!user) {
        return res.status(httpCode.BAD_REQUEST).json('co loi xay ra trong qua trinh dang nhap')
      }
      if (user.isLocked) {
        return res.status(httpCode.USER_BLOCK).json({ msg: 'User bi khoa' })
      }
      res.status(user.isLogin ? httpCode.SUCCESS : httpCode.CREATED).json(user)
    } catch (e) {
      if (e.code === 'auth/id-token-expired') {
        return res.status(httpCode.BAD_REQUEST).json({
          ok: false,
          msg: e.message
        })
      }
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({
        ok: false,
        env: process.env.DISABLE_SIGNATURE
      })
    }
  }

  const updateSelfInfo = async (req, res) => {
    try {
      const {
        name,
        avatar,
        about
      } = req.body
      const { uid } = req.user
      if (!uid || Object.keys(req.body).length === 0) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }
      const update = {}
      if (name) {
        update.name = name
      }
      if (avatar) {
        update.avatar = avatar
      }
      if (about) {
        update.about = about
      }
      const user = await userRepo.updateUserByUid({ uid }, update)
      setTimeout(() => {
        mediator.emit(eventConfig.USER_CHANGE, {
          uid,
          action: actionConfig.UPDATE
        })
      }, 1)
      res.status(httpCode.SUCCESS).json({
        ok: true,
        user
      })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }

  const refreshToken = async (req, res) => {
    try {
      const token = req.headers['x-access-token'] || req.body.token
      if (token) {
        const user = serverHelper.decodeToken(token)
        if (!user) {
          res.status(httpCode.UNAUTHORIZED).json({ ok: false })
        }
        if (user.loginType !== loginType.USER) {
          const {
            deviceType,
            deviceId,
            versionCode,
          } = user
          const token = serverHelper.genToken({
            deviceType,
            versionCode,
            deviceId,
            loginType: loginType.GUEST
          })
          return res.status(httpCode.SUCCESS).json({ token })
        }
        const {
          ok,
          data
        } = await handleRefreshToken(token, user.uid)
        if (ok) {
          return res.status(httpCode.SUCCESS).json(data)
        }
      }
      res.status(httpCode.UNAUTHORIZED).json({ ok: false })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const verifyToken = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      if (token) {
        const { uid } = (await serverHelper.verifyToken(token)) || {}
        if (uid) {
          const hash = serverHelper.generateHash(token)
          const sess = await sessionRepo.findOne({
            uid,
            hash
          })
          if (sess) {
            return res.status(httpCode.SUCCESS).json({})
          }
        }
        return res.status(httpCode.UNAUTHORIZED).json({})
      }
      res.status(httpCode.UNAUTHORIZED).json({})
    } catch (e) {
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  const getUserFromCache = async (req, res) => {
    const token = req.headers['x-access-token']
    if (token === 'ssr') {
      return res.status(httpCode.SUCCESS).json({})
    }
    const decode = serverHelper.decodeToken(token)
    const { uid } = decode
    const user = await blockRepo.getUserInfo(uid)
    res.status(httpCode.SUCCESS).json({ user })
  }
  const getUserDetail = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      if (token) {
        const { uid } = (await serverHelper.verifyToken(token)) || {}
        if (!uid) {
          return res.status(httpCode.UNAUTHORIZED).json({})
        }
        const user = await userRepo.findOne({ uid })
        if (user) {
          const u = user.toObject()
          delete u.password
          u.avatar = serverHelper.getAvatar(u.avatar, u.provider)
          return res.status(httpCode.SUCCESS).json(u)
        }
        return res.status(httpCode.UNAUTHORIZED).json({ msg: 'UNAUTHORIZED user' })
      } else {
        res.status(httpCode.BAD_REQUEST).json({ ok: false })
      }
    } catch (e) {
      if (e.message.includes('TokenExpiredError')) {
        return res.status(httpCode.TOKEN_EXPIRED).json({})
      }
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const getListUserByIds = async (req, res) => {
    try {
      const ids = (req.query.ids || '').split(',')
      if (!ids.length) {
        res.status(httpCode.BAD_REQUEST).json({})
      }
      const users = await userRepo.getListUserByIds(ids)
      res.status(httpCode.SUCCESS).json({ data: users })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const enterGuest = async (req, res) => {
    try {
      const {
        error,
        value
      } = schemaValidator(req.body, 'EnterGuest')
      if (error) {
        return res.status(httpCode.BAD_REQUEST).json({
          ok: false,
          msg: error.toString()
        })
      }
      const {
        deviceType,
        deviceId,
        versionCode
      } = value
      const token = serverHelper.genToken({
        deviceType,
        versionCode,
        deviceId,
        loginType: loginType.GUEST
      })
      res.status(httpCode.SUCCESS).json({ token })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const logout = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      const user = serverHelper.decodeToken(token)
      if (user && user.loginType === loginType.USER) {
        const { uid } = user
        const hash = serverHelper.generateHash(token)
        const r = await sessionRepo.removeSession({
          uid,
          hash
        })
      }
      res.status(httpCode.SUCCESS).json({})
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const ping = async (req, res) => {
    try {
      const token = req.headers['x-access-token']
      if (token) {
        const now = (Date.now()) / 1000
        const user = serverHelper.decodeToken(token)
        if (!user) {
          return res.status(httpCode.FORBIDDEN).json({})
        }
        const { exp } = user
        if (now > exp) {
          return res.status(httpCode.TOKEN_EXPIRED).json({})
        }
        if (user.loginType === loginType.USER) {
          const isKick = await blockRepo.isKick(token)
          if (isKick) {
            return res.status(httpCode.UNAUTHORIZED).json({ msg: i18n.kick })
          }
          // await blockRepo.setUserData(user.uid, { lastPing: now })
          await pingRepo.saveLastPing(user.uid, user.deviceType, user.loginType)
        }
        await pingRepo.saveLastPing(user.deviceId, user.deviceType, user.loginType)
        res.status(httpCode.SUCCESS).json({})
      } else {
        res.status(httpCode.UNAUTHORIZED).json({})
      }
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({ ok: false })
    }
  }
  const addFCMToken = async (req, res) => {
    try {
      const { fcmToken } = req.body
      if (!fcmToken) {
        return res.status(httpCode.BAD_REQUEST).json({})
      }
      const user = req.user
      const {
        uid,
        deviceId,
        deviceType
      } = user
      const { statusCode } = await oAuthHelper.updateTopic({
        fcmToken,
        deviceType
      })
      if (statusCode !== httpCode.SUCCESS) return res.status(httpCode.BAD_REQUEST).json({})
      if (user.loginType === loginType.GUEST) {
        await sessionRepo.updateSessionByCondition({
          uid: { $exists: false },
          deviceId
        }, {
          fcmToken,
          deviceType,
          updatedAt: Math.floor(Date.now() / 1000)
        }, { upsert: true })
      } else {
        await sessionRepo.updateSessionByCondition({
          uid,
          deviceId
        }, {
          fcmToken,
          updatedAt: Math.floor(Date.now() / 1000)
        }, { upsert: true })
      }
      res.status(httpCode.SUCCESS).json({ ok: true })
    } catch (e) {
      logger.e(e)
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }
  return {
    addFCMToken,
    loginOrRegister,
    refreshToken,
    ping,
    getUserDetail,
    enterGuest,
    logout,
    verifyToken,
    getListUserByIds,
    getUserFromCache,
    updateSelfInfo,
  }
}
