module.exports = (joi, deviceTypes, loginMethod) => {
  return joi.object({
    token: joi.string().optional(),
    deviceId: joi.string().min(1).required(),
    name: joi.string().optional(),
    avatar: joi.string().optional(),
    code: joi.string().optional(),
    deviceName: joi.string().optional(),
    domain: joi.string().optional()
  })
}
