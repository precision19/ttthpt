const joi = require('@hapi/joi')
const mongoose = require('mongoose')
module.exports = container => {
  const { deviceTypes, loginMethod } = container.resolve('config')
  container.registerValue('ObjectId', mongoose.Types.ObjectId)
  const User = require('./user.model')(joi, mongoose)
  const Login = require('./joi/login.model')(joi)
  const Session = require('./session.model')(joi, mongoose)
  const EnterGuest = require('./joi/enterGuest.model')(joi)
  const schemas = {
    mongoose: {
      User, Session
    },
    joi: { Login, EnterGuest }
  }
  const schemaValidator = (obj, type) => {
    const schema = schemas.joi[type]
    if (schema) {
      return schema.validate(obj, {
        allowUnknown: true
      })
    }
    return { error: `${type} not found.` }
  }
  return { schemas, schemaValidator }
}
