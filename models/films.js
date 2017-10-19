'use strict';
module.exports = function(sequelize, DataTypes) {
  var films = sequelize.define('films', {
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    release_date: {
      type: DataTypes.DATE,
      allowNull: false
    },
    tagline: {
      type: DataTypes.STRING,
      allowNull: false
    },
    revenue: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    budget: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    runtime: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    original_language: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false
    },
    genre_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  }, {timestamps: false});

  films.associate = function(models) {
    films.hasOne(models.genres, {as: 'genres', foreignKey: 'genre_id'});
  }

  return films;
};
