const request = require('supertest');
const { app } = require('../../server');

describe('POST /api/calc', () => {
  test('returns 200 and correct shape for valid input', async () => {
    const res = await request(app)
      .post('/api/calc')
      .send({ percentage: 20, duration: { hours: 5, minutes: 30 } })
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('original');
    expect(res.body).toHaveProperty('new');
    expect(res.body.original).toHaveProperty('totalSeconds');
    expect(res.body.new).toHaveProperty('totalSeconds');
  });

  test('returns 400 for invalid percentage', async () => {
    const res = await request(app)
      .post('/api/calc')
      .send({ percentage: -5, duration: { hours: 1 } });
    expect(res.statusCode).toBe(400);
  });
});
