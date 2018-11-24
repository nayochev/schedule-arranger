//予定を作成するハンドラ
'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const uuid = require('uuid');

//予定と候補のモデルの読み込み
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const User = require('../models/user');

router.get('/new', authenticationEnsurer, (req,res,next) => {
  res.render('new',{ user: req.user });
});

router.post('/', authenticationEnsurer, (req, res, next) => {
  //予定IDと更新日時の生成
  const scheduleId = uuid.v4();
  const updatedAt = new Date();
  //予定をデータベースに保存
  Schedule.create({
    scheduleId: scheduleId,
    scheduleName: req.body.scheduleName.slice(0, 255),  //予定名を255文字以内にする
    memo: req.body.memo,
    createdBy: req.user.id,
    updatedAt: updatedAt
  }).then((schedule) => {
    const candidateNames = req.body.candidates.trim().split('\n').map((s) => s.trim()).filter((s) => s !== "");
    const candidates = candidateNames.map((c) => { return {
      candidateName: c,
      scheduleId: schedule.scheduleId
    };});
    Candidate.bulkCreate(candidates).then(() => {
      res.redirect('/schedules/' + schedule.scheduleId);
    });
  });
});

router.get('/:scheduleId', authenticationEnsurer, (req,res,next) => {
  //findOne関数で該当する1行だけのデータを取得する
  Schedule.findOne({
    include: [
      {
        model: User,
        attributes: ['userId','username']
      }
    ],
    where: {
      scheduleId: req.params.scheduleId
    },
    //予定の更新日時の降順で取得する
    order: [['"updatedAt"','DESC']]
  }).then((schedule) => {
    //予定が見つかった場合にその候補一覧を取得する
    if(schedule) {
      Candidate.findAll({
        where: {scheduleId: schedule.scheduleId},
        //候補IDの昇順で候補一覧を取得する
        order: [['"candidateId"','ASC']]
      }).then((candidates) => {
        res.render('schedule',{
          user: req.user,
          schedule: schedule,
          candidates: candidates,
          users: [req.user]
        });
      });
    } else {
      const err = new Error('指定された予定が見つかりません');
      err.status = 404;
      next(err);
    }
  });
});

module.exports = router;


