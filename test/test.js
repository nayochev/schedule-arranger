'use strict';
const request = require('supertest');
const assert = require('assert');
const app = require('../app');
const passportStub = require('passport-stub');
const User = require('../models/user');
const Schedule = require('../models/schedule');
const Candidate = require('../models/candidate');
const Availability = require('../models/availability');

//ログイン時のテスト
describe('/login', () => {

  before(() => {
    passportStub.install(app);
    passportStub.login({ username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('ログインのためのリンクが含まれる',(done) => {
    request(app)
    .get('/login')
    .expect('Content-type','text/html; charset=utf-8')
    .expect(/<a href="\/auth\/github"/)
    .expect(200, done);
  });

  it('ログイン時にユーザー名が表示される',(done) => {
    request(app)
    .get('/login')
    .expect(/testuser/)
    .expect(200, done);
  });

});

//ログアウト時のテスト
describe('/logout', () => {

  it('/にリダイレクトされる', (done) => {
    request(app)
    .get('/logout')
    .expect('Location','/')
    .expect(302, done);
  });
  
});

//予定が作成でき表示されるテスト
describe('/schedule', () => {

  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0 , username: 'testuser'});
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('予定が作成でき、表示される', (done) => {
    User.upsert({ userId: 0, username: 'testuser'}).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テスト予定1', memo: 'テストメモ1\n\テストメモ2', candidates: '候補1\n\候補2\n\候補3'})
        .expect('Location',/schedules/)
        .expect(302)
        .end((err,res) => {
          const createdSchedulePath = res.headers.location;
          request(app)
            .get(createdSchedulePath)
            .expect(/テスト予定1/)
            .expect(/テストメモ1/)
            .expect(/テストメモ2/)
            .expect(/候補1/)
            .expect(/候補2/)
            .expect(/候補3/)
            .expect(200)
            .end((err,res) => {
              deleteScheduleAggregate(createdSchedulePath.split('/schedules/')[1], done, err);
            });
        });
    });
  });
});

describe('/schedules/:scheduleId/users/:userId/candidates/:candidateId',() => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.uninstall(app);
    passportStub.logout();
  });

  it('出欠が更新できる', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テスト出欠更新予定1', memo: 'テスト出欠更新メモ1', candidates: 'テスト出欠更新候補1' })
        .end((err, res) => {
          const createdSchedulePath = res.headers.location;
          const scheduleId = createdSchedulePath.split('/schedules/')[1]; 
          Candidate.findOne({
            where: { scheduleId: scheduleId }
          }).then((candidate) => {
            // 更新がされることをテスト
            const userId = 0;
            request(app)
              .post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidate.candidateId}`)
              .send({ availability: 2 }) // 出席に更新
              .expect('{"status":"OK","availability":2}')
              .end((err, res) => {
                Availability.findAll({
                  where: { scheduleId: scheduleId }
                }).then((availabilities) => {
                  assert.equal(availabilities.length, 1);
                  assert.equal(availabilities[0].availability, 2);
                  deleteScheduleAggregate(scheduleId, done, err);
                });
              });
          });
        });
    });
  });
});

//出欠・候補を削除する関数
function deleteScheduleAggregate(scheduleId, done, err) {
  Availability.findAll({
    where: { scheduleId: scheduleId }
  }).then((availabilities) => {
    const promises = availabilities.map((a) => { return a.destroy(); });
    Promise.all(promises).then(() => {
      Candidate.findAll({
        where: { scheduleId: scheduleId }
      }).then((candidates) => {
        const promises = candidates.map((c) => { return c.destroy(); });
        Promise.all(promises).then(() => {
          Schedule.findById(scheduleId).then((s) => { s.destroy(); });  
          if (err) return done(err);
          done();
        });
      });
    });
  });
}