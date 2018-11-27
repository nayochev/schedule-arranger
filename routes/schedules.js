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
const Availability = require('../models/availability');

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
        //データベースからその予定の全ての出欠を取得する
        Availability.findAll({
          include: [
            {
              model: User,
              attributes: ['userId','username']
            }
          ],
          where: {
            scheduleId: schedule.scheduleId
          },
          order: [[User,'username','ASC'],['"candidateId"','ASC']]  //取得する順番をユーザー名の昇順、候補IDの昇順
        }).then((availabilities) => {
          // 出欠 MapMap(キー:ユーザー ID, 値:出欠Map(キー:候補 ID, 値:出欠)) を作成する
          const availabilityMapMap = new Map();        // key: userId, value: Map(key: candidateId, availability)
          availabilities.forEach((a) => {
            const map = availabilityMapMap.get(a.user.userId) || new Map();
            map.set(a.candidateId, a.availability);
            availabilityMapMap.set(a.user.userId, map);
          });

          // 閲覧ユーザーと出欠に紐づくユーザーからユーザー Map (キー:ユーザーID, 値:ユーザー) を作る
          const userMap = new Map();  // key: userId, value: User
          userMap.set(parseInt(req.user.id), {
            isSelf: true,
            userId: parseInt(req.user.id),  
            username: req.user.username
          });
          availabilities.forEach((a) => {
            userMap.set(a.user.userId, {
              isSelf: parseInt(req.user.id) === a.user.userId,  //閲覧ユーザー自身であるかを確かめる
              userId: a.use.userId,
              username: a.user.username
            });
          });

          // 全ユーザー、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
          const users = Array.from(userMap).map((keyValue) => keyValue[1]);
          users.forEach((u) => {
            candidates.forEach((c) => {
              const map = availabilityMapMap.get(u.userId) || new Map();
              const a = map.get(c.candidateId) || 0; //デフォルト値は0に指定
              map.set(c.candidateId,a);
              availabilityMapMap.set(u.userId, map);
            });
          });

          res.render('schedule',{
            user: req.user,
            schedule: schedule,
            candidates: candidates,
            users: users,
            availabilityMapMap: availabilityMapMap
          });
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


