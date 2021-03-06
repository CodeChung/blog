const express = require('express')
const path = require('path')
const xss = require('xss')
const ArticlesService = require('./articles-service')

const articlesRouter = express.Router()
const jsonParser = express.json()

const sanitizedArticle = article => ({
    id: article.id,
    style: article.style,
    title: xss(article.title),
    content: xss(article.content),
    date_published: article.date_published
})

articlesRouter
  .route('/')
  .get((req, res, next) => {
    ArticlesService.getAllArticles(
      req.app.get('db')
    )
      .then(articles => {
        res.json(articles.map(sanitizedArticle))
      })
      .catch(next)
  })
  .post(jsonParser, (req, res, next) => {
    const { title, content, style } = req.body
    const newArticle = { title, content, style }

    for (const [key, value] of Object.entries(newArticle)) {
        if (value == null) {
            return res.status(400).json({
                error: { message: `Missing '${key}' in request body`}
            })
        }
    }

    ArticlesService.insertArticle(
      req.app.get('db'),
      newArticle
    )
      .then(article => {
        res
          .status(201)
          //path prevents the double slash issue from occurring 
          .location(path.posix.join(req.originalUrl, `/${article.id}`))
          .json(sanitizedArticle(article))
      })
      .catch(next)
  })

articlesRouter
  .route('/:article_id')
  .all((req, res, next) => {
    const knexInstance = req.app.get('db')
    ArticlesService.getById(
        knexInstance,
        req.params.article_id
    )
        .then(article => {
            if (!article) {
                return res.status(404).json({
                    error: { message: `Article doesn't exist`}
                })
            }
            res.article = article // save the article for the next middleware
            next() // don't forget to call next so the next middleware happens!
        })
        .catch(next)
  })
  .get((req, res, next) => {
    res.json(sanitizedArticle(res.article))
  })
  .delete((req, res, next) => {
    const knexInstance = req.app.get('db')
    ArticlesService.deleteArticle(knexInstance, req.params.article_id)
      .then(() => {
          res.status(204).end()
      })
      .catch(next)
  })
  .patch(jsonParser, (req, res, next) => {
    const knexInstance = req.app.get('db')
    const { title, content, style } = req.body
    const articleToUpdate = { title, content, style }

    const numberOfValues = Object.values(articleToUpdate).filter(Boolean).length
    if (numberOfValues === 0) {
      return res.status(400).json({
        error: {
          message: `Request body must content either 'title', 'style', or 'content'`
        }
      })
    }

    ArticlesService.updateArticle(
      knexInstance,
      req.params.article_id,
      articleToUpdate
    )
    .then(numRowsAffect => {
      res.status(204).end()
    })
  })

module.exports = articlesRouter