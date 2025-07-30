  const chai = require('chai');
  const expect = chai.expect;
  const sinon = require('sinon');
  const supertest = require('supertest');
  const express = require('express');
  const bodyParser = require('body-parser');
  const aiController = require('../controllers/answerDSAQuestion');
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  require('dotenv').config();

  // Setup Express app and attach routes
  const app = express();
  app.use(bodyParser.json());

  app.post('/answer', aiController.answerDSAQ);
  app.post('/followup', aiController.answerFollowUp);
  app.post('/refresh', aiController.refreshContent);
  app.post('/skeleton', aiController.generateSkeletonCode);

  // Unit Tests
  describe('AI Controller Unit Tests', () => {
    let sandbox;


      // Set the global timeout for all tests in this suite
    before(function() {
      this.timeout(100000); // Set a global timeout of 10 seconds for all tests in this suite
    });

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    describe('answerDSAQ', function () {
      it('should properly validate input parameters', async () => {
        const req = {
          headers: { 'x-session-id': 'test123' },
          body: {}
        };

        const res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub()
        };

        await aiController.answerDSAQ(req, res);

        expect(res.status.calledWith(400)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.firstCall.args[0].error).to.include('Problem statement is required');
      });

      it('should handle AI service errors gracefully', async () => {
        // Stub the model's generateContent to simulate failure
        const fakeModel = {
          generateContent: sinon.stub().rejects(new Error('Service unavailable'))
        };
        sandbox.stub(GoogleGenerativeAI.prototype, 'getGenerativeModel').returns(fakeModel);

        const req = {
          headers: { 'x-session-id': 'test123' },
          body: {
            problemStatement: 'Implement quicksort',
            language: 'javascript'
          }
        };

        const res = {
          status: sinon.stub().returnsThis(),
          json: sinon.stub()
        };

        await aiController.answerDSAQ(req, res);

        expect(res.status.calledWith(500)).to.be.true;
        expect(res.json.calledOnce).to.be.true;
        expect(res.json.firstCall.args[0].error).to.include('Failed to generate solution');
      });
    });

    describe('answerFollowUp', () => {
        it('should validate required follow-up parameters', () => {
          const req = {
            body: {
              sessionId: 'test123',
              language: 'python'
            }
          };
    
          const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
          };
    
          aiController.answerFollowUp(req, res);
    
          expect(res.status.calledWith(400)).to.be.true;
          expect(res.json.firstCall.args[0].error).to.include('Follow-up question');
        });
      });

      describe('refreshContent', () => {
        it('should validate section parameter', () => {
          const req = {
            body: {
              sessionId: 'test123',
              language: 'python',
              question: 'Sort an array',
              historyData: { chatHistory: [] }
              // Missing section parameter
            }
          };
          const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
          };
          
          aiController.refreshContent(req, res);
          
          expect(res.status.calledWith(400)).to.be.true;
          expect(res.json.firstCall.args[0].error).to.include('Section');
        });
        
        it('should validate that section is one of the allowed values', async () => {
          const req = {
            body: {
              sessionId: 'test123',
              section: 'InvalidSection',
              language: 'python',
              question: 'Sort an array',
              historyData: { chatHistory: [] }
            }
          };
          const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
          };
          
          await aiController.refreshContent(req, res);
          
          expect(res.status.calledWith(400)).to.be.true;
          expect(res.json.firstCall.args[0].error).to.include('Section must be a valid value');
        });
      });
      
      describe('generateSkeletonCode', () => {
        it('should validate history data contains code', () => {
          const req = {
            body: {
              sessionId: 'test123',
              language: 'python',
              question: 'Generate skeleton',
              historyData: { /* No Code property */ }
            }
          };
          const res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub()
          };
          
          aiController.generateSkeletonCode(req, res);
          
          expect(res.status.calledWith(500)).to.be.true;
          expect(res.json.firstCall.args[0].error).to.include('Original code missing');
        });
      });
    });

    // Integration Tests
    describe('AI Controller Integration Tests', () => {
      let sandbox;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
      });

      afterEach(() => {
        sandbox.restore();
      });

      describe('POST /answer',function () {
        this.timeout(100000); // 100 seconds for the entire suite
        it('should return 400 if sessionId is missing', async () => {
          const res = await supertest(app)
            .post('/answer')
            .send({ problemStatement: 'Sort an array' });

          expect(res.status).to.equal(400);
          expect(res.body.error).to.equal('Session ID is required.');
        });

        it('should return 400 if problemStatement is missing', async () => {
          const res = await supertest(app)
            .post('/answer')
            .send({ sessionId: 'abc123' });

          expect(res.status).to.equal(400);
          expect(res.body.error).to.equal('Problem statement is required.');
        });

        it('should return 200 with real solutions if valid input is given', async function () {
          this.timeout(100000);  // This ensures the test doesn't fail too quickly.
        
          try {
            const res = await supertest(app)
              .post('/answer')
              .send({
                sessionId: 'abc123',
                problemStatement: 'Sort an array'
              })
              .timeout(100000);  // Set supertest timeout as well
        
            expect(res.status).to.equal(200);
            expect(res.body).to.have.property('solutions');
            expect(res.body.solutions).to.have.property('python');
            expect(res.body.solutions).to.have.property('javascript');
          } catch (err) {
            console.error("Test failed due to error:", err);
            throw err;  // This ensures the test properly reports failure if it happens.
          }
        });
      });

      describe('POST /followup', function () {
        this.timeout(100000); // 100 seconds for the entire suite
        it('should return 400 if doubt is missing', async () => {
          const res = await supertest(app)
            .post('/followup')
            .send({ sessionId: 'abc123', language: 'python' });

          expect(res.status).to.equal(400);
          expect(res.body.error).to.include('Follow-up question');
        });

        it('should return 400 if historyData is missing', async () => {
          const res = await supertest(app)
            .post('/followup')
            .send({
              sessionId: 'abc123',
              doubt: 'Why is this O(n^2)?',
              language: 'python'
            });

          expect(res.status).to.equal(400);
          expect(res.body.error).to.include('History');
        });

        it('should return 200 with follow-up answer if valid', async () => {
          sandbox.stub(aiController, 'answerFollowUp').callsFake(async (req, res) => {
            res.status(200).json({
              answer: {
                Code: 'print("Optimized")',
                Logic: 'Optimized logic',
                Time_Complexity: 'O(n)',
                Space_Complexity: 'O(1)',
                Improvements: 'None',
                AnswerToFollowUp: 'The algorithm is O(n^2) in worst case because...'
              },
              newMessage: { role: 'model', content: 'Here\'s your follow-up.' }
            });
          });

          const res = await supertest(app)
            .post('/followup')
            .send({
              sessionId: 'abc123',
              doubt: 'Why is this O(n^2)?',
              language: 'python',
              historyData: { chatHistory: [] }
            });

          expect(res.status).to.equal(200);
          expect(res.body.answer).to.have.property('Code');
          expect(res.body.answer).to.have.property('AnswerToFollowUp');
          expect(res.body).to.have.property('newMessage');
        });
      });

      describe('POST /refresh', function (){
        this.timeout(100000); // 100 seconds for the entire suite
        it('should return 400 if section is missing', async () => {
          const res = await supertest(app)
            .post('/refresh')
            .send({
              sessionId: 'abc123',
              language: 'python',
              question: 'Optimize this',
              historyData: { chatHistory: [] }
            });

          expect(res.status).to.equal(400);
          expect(res.body.error).to.include('Section');
        });

        it('should return 400 if section is invalid', async () => {
          const res = await supertest(app)
            .post('/refresh')
            .send({
              sessionId: 'abc123',
              section: 'InvalidSection',
              language: 'python',
              question: 'Optimize this',
              historyData: { chatHistory: [] }
            });

          expect(res.status).to.equal(400);
          expect(res.body.error).to.include('Section must be a valid value.');
        });
      });

      describe('POST /skeleton', function (){
        this.timeout(100000); // 100 seconds for the entire suite
        it('should return 500 if code is missing in historyData', async () => {
          const res = await supertest(app)
            .post('/skeleton')
            .send({
              sessionId: 'abc123',
              language: 'python',
              question: 'Skeleton please',
              historyData: {}
            });

          expect(res.status).to.equal(500);
          expect(res.body.error).to.include('Original code missing');
        });
        
        // it('should handle errors during skeleton generation', async () => {
        //   sandbox.stub(aiController, 'generateSkeletonCode').callsFake(async (req, res) => {
        //     res.status(500).json({ error: 'Failed to generate skeleton code' });
        //   });

        //   const res = await supertest(app)
        //     .post('/skeleton')
        //     .send({
        //       sessionId: 'abc123',
        //       language: 'python',
        //       question: 'Skeleton please',
        //       historyData: { Code: 'print("hello")' }
        //     });

        //   expect(res.status).to.equal(500);
        //   expect(res.body.error).to.include('Failed to generate skeleton');
        // });
      });
    });

    // Mock implementation tests (to test internal functions)
    describe('AI Controller Internal Functions', () => {
      let sandbox;

      beforeEach(() => {
        sandbox = sinon.createSandbox();
      });

      afterEach(() => {
        sandbox.restore();
      });
      
    }); 