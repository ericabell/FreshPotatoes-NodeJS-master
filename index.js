const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request-promise'),
      express = require('express'),
      app = express();

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;



const models = require('./models');

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  let queryKeys = Object.keys(req.query);
  // query keys might be 'limit' and 'offset'

  let filmId = req.params.id;
  // 1. find the film that was passed in
  models.films.findById(filmId)
    .then( (film) => {
      // 2. use the genre_id to find all films with that genre and within +/- 15 years
      let lowDate = new Date(film.release_date);
      let highDate = new Date(film.release_date);
      lowDate.setFullYear(lowDate.getFullYear() - 15);
      highDate.setFullYear(highDate.getFullYear() + 15);

      models.films.findAll({
        attributes: ['id', 'title', 'release_date', 'genre_id'],
        where: {
          genre_id: film['genre_id'],
          release_date: {
            $and: {
              $gt: lowDate  ,
              $lt: highDate
            }
          }
        },
      })
      .then( (results) => {
        // use the external API to check each film and accept only
        // those films who:
        // 1. minimum of 5 reviews
        // 2. average rating greater than 4.0
        Promise.all(results.map(film => new Promise((resolve, reject)=>{
          request.get(`http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${film.id}`, (err, res, html)=>{
            if(err){
              return reject(err);
            }
            return resolve(res, html);
          });
        })))
        .then( (reviews) => {
          res.json({'reviews': reviews.body})
        })

        .catch( (error) => {
          res.send(error);
        });
    })
    .catch( (err) => {
      res.status(422);
      res.json({message: '"message" key missing'});
    })
  })
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  console.log('caught missing route');
  res.status(404).json({message: '"message" key missing'});
});


module.exports = app;
