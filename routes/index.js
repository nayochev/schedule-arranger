'use strict';
const express = require('express');
const router = express.Router();
const Schedule = require('../models/schedule');

router.get('/', (req, res, next) => {
  const title = '予定調整くん';
  if (req.user) {
    //findAll関数で条件に合うデータを取得する
    Schedule.findAll({
      where: {
        createdBy: req.user.id
      },
      order: [['"updatedAt"', 'DESC']]
    }).then((schedules) => {  //取得したデータをレンダリング時に渡す
      res.render('index', {
        title: title,
        user: req.user,
        schedules: schedules
      });
    });
  } else {
    res.render('index', { title: title, user: req.user });
  }
});

module.exports = router;