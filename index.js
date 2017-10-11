const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
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
  // let queryKeys = Object.keys(req.query);
  // console.log(queryKeys);
  // if( !('message' in queryKeys) ) {
  //   res.send(422);
  // }

  let filmId = req.params.id;
  // 1. find the film that was passed in
  models.films.findById(filmId)
    .then( (film) => {
      // 2. use the genre_id to find all films with that genre and Date
      let lowDate = new Date(film.release_date);
      let highDate = new Date(film.release_date);
      lowDate.setFullYear(lowDate.getFullYear() - 15);
      highDate.setFullYear(highDate.getFullYear() + 15);

      models.films.findAll({
        where: {
          genre_id: film['genre_id'],
          release_date: {
            $and: {
              $gt: lowDate  ,
              $lt: highDate
            }
          }
        },
        limit: 10
      })
      .then( (results) => {
        res.json({'recommendations': results,
                  'meta': {'limit': 10, 'offset': 0}
      });
      })
    })
    .catch( (err) => {
      res.status(422);
      res.json({message: '"message" key missing'});
    })
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  console.log('caught missing route');
  res.status(404).json({message: '"message" key missing'});
});


module.exports = app;
