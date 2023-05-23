const request = require('request-promise')
module.exports = (container) => {
  const {
    serverHelper,
    httpCode
  } = container.resolve('config')
  const { sessionRepo } = container.resolve('repo')
  const logger = container.resolve('logger')
  const verifyAccessToken = async (req, res, next) => {
    return next()
  }

  async function verifyTokenCMS (req, res, next) {
    try {
      const token = req.headers['x-access-token'] || req.body.token
      console.log('token', token)
      console.log('internal', INTERNAL_TOKEN)
      if (token === INTERNAL_TOKEN) {
        return next()
      }
      if (token) {
        const user = await serverHelper.decodeToken(token)
        const { path } = req
        const options = {
          headers: { 'x-access-token': token },
          uri: process.env.AUTHORIZATION_CMS_URL || 'http://localhost:8004/authorization',
          method: 'POST',
          json: {
            userId: user._id,
            path,
            method: req.method
          }
        }
        const {
          ok,
          msg,
          user: userAuthorization
        } = await request(options)
        if (ok) {
          if (userAuthorization.readonly && req.method !== 'GET') {
            return res.status(httpCode.BAD_REQUEST).json({ msg: 'Bạn chỉ có quyền xem thông tin, không thể thực hiện được thao tác này.' })
          }
          req.user = userAuthorization
          return next()
        } else {
          return res.status(httpCode.BAD_REQUEST).json({ msg: msg || 'Bạn không có quyền thực hiện tác vụ này.' })
        }
      }
      return res.status(httpCode.UNAUTHORIZED).json({ msg: 'Bạn không có quyền thực hiện tác vụ này.' })
    } catch (e) {
      console.error((e.stack))
      if (!e.message.includes('TokenExpiredError')) {
        logger.e(e)
      }
      res.status(httpCode.TOKEN_EXPIRED).json({})
    }
  }

  const verifySession = async (req, res, next) => {
    try {
      const token = req.headers['x-access-token']
      if (token) {
        const user = (await serverHelper.verifyToken(token)) || {}
        const { uid } = user
        if (uid) {
          const hash = serverHelper.generateHash(token)
          const isValid = await sessionRepo.findOne({
            uid,
            hash
          })
          if (isValid) {
            req.user = user
            return next()
          }
        }
        res.status(httpCode.UNAUTHORIZED).json({})
      } else {
        res.status(httpCode.UNAUTHORIZED).json({})
      }
    } catch (e) {
      res.status(httpCode.UNKNOWN_ERROR).json({})
    }
  }

  const verifyToken = async (req, res, next) => {
    try {
      // return next()
      const token = req.headers['x-access-token'] || ''
      const user = await serverHelper.verifyToken(token)
      req.user = user
      return next()
    } catch (e) {
      // logger.e(e)
      res.status(httpCode.TOKEN_EXPIRED).json({})
    }
  }

  const verifySignature = async (req, res, next) => {
    try {
      if (Object.keys(req.body).length) {
        const isTrust = serverHelper.isTrustSignature(req.body)
        if (isTrust) {
          delete req.body.signature
          return next()
        }
        return res.status(httpCode.SIGNATURE_ERROR).json({ msg: '?' })
      }
      return next()
    } catch (e) {
      // logger.e(e)
      res.status(httpCode.TOKEN_EXPIRED).json({})
    }
  }
  const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN || '123'
  const verifyInternalToken = async (req, res, next) => {
    const token = req.headers['x-access-token']
    if (token !== INTERNAL_TOKEN) {
      return res.status(httpCode.BAD_REQUEST).json({ msg: 'Bạn không có quyền thực hiện tác vụ này!' })
    }
    return next()
  }
  return {
    verifyTokenCMS,
    verifySession,
    verifyAccessToken,
    verifyToken,
    verifySignature,
    verifyInternalToken
  }
}
