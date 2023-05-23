const express = require('express')
const morgan = require('morgan')
const helmet = require('helmet')
const cors = require('cors')
const bodyParser = require('body-parser')
const api = require('../api')
const start = (container) => {
  return new Promise((resolve, reject) => {
    const { serverSettings } = container.resolve('config')
    const { port } = serverSettings
    const repo = container.resolve('repo')
    if (!repo) {
      reject(new Error('The server must be started with a connected repository'))
    }
    if (!port) {
      reject(new Error('The server must be started with an available port'))
    }
    const app = express()
    app.get('/health', (req, res) => {
      res.status(200).send(process.env.VERSION || '')
    })
    morgan.token('body', function (req) { return JSON.stringify(req.body) })
    app.use(morgan(':method :url :remote-addr :status :response-time ms - :res[content-length] :body - :req[content-length]'))
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())
    app.use(helmet())
    app.use(cors())
    // app.use(checkAccessToken)
    app.use((err, req, res, next) => {
      reject(new Error('Something went wrong!, err:' + err))
      res.status(500).send('Something went wrong!')
      return next()
    })
    api(app, container)
    const server = app.listen(port, () => resolve(server))
  })
}
module.exports = { start }
