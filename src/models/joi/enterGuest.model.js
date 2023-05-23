module.exports = (joi, deviceTypes) => {
  return joi.object({
    deviceId: joi.string().min(1).required(),
    deviceName: joi.string().optional()
  })
}
