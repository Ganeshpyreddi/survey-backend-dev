const db = require("../models")
const user = db.user
const question = db.question
const survey = db.survey
const service = require("../services/surveyService")
const email = require("../services/email")
const response = db.response
exports.createSurvey = async (req, res) => {
    try {
      //checking title and description
      if (!req.body.description || !req.body.title) {
        return res.status(400).json({
          message: "Error.! title and description missing"
        })
      }
      const {title,description,makeLive,questions}= req.body
      let Survey = await survey.create({
        surveyTitle:title,
        surveyDescription:description,
        makeLive:makeLive,
        userId:req.userId
      })
      for (let i = 0; i <= questions.length-1; i++) {
         await service.createQuestion(questions[i], Survey.dataValues.id)
      }
      let surveyInfo = await survey.findOne({
        where: { id: Survey.dataValues.id },
        include: [
        {
            model: db.question, as: 'question',
            include: [{
              model: db.option, as: "option"
            }]
          }
        ]
      })
      console.log("info",surveyInfo)
      res.status(200).send(surveyInfo)
    } catch (err) {
      res.status(500).send(err)
    }
  
  };


  exports.surveyList =async (req, res) => {
    if(req.query.adminId){
      //get user
      let userFound = await user.findOne({
        where:{id:req.query.adminId}
      })
      if(userFound){
        let surveyList = await survey.findAll({
          where:{userId:userFound.id}
        })
        console.log("user",userFound)
        return res.status(200).send({
          surveys:surveyList,
          userDetails:{  
            username:userFound.username,
          }
        })
      }else{
        return res.status(404).send("user not found")
      }
    }else{
    //find all surveys
  survey.findAll({
      where: { userId: req.userId }
    })

    .then((surveys) => {
      
      res.status(200).send(surveys);

    })
    .catch((err) => {
      console.log("error");
      res.status(500).send({ message: err.message });
    });
  }
}

  exports.deleteSurvey = (req, res) => {
    const id = req.params.id;
    survey.destroy({
      where: { id: id }
    })
      .then(async response => {
        if (response == 1) {
          console.log("resp",response)
         await question.destroy({
            where:{surveyId:null}
          })
          res.send({
            message: "Survey  deleted successfully!"
          });
        } else {
          res.send({
            message: `Cannot delete Survey  with id=${id}. Maybe Survey was not found!`
          });
        }
      })
      .catch(err => {
        res.status(500).send({
          message: "Could not delete survey with id=" + id
        });
      });
  };

  exports.makeSurveyLive = async(req, res) => {
    //find all users
    if(req.query.makeLive === "false"){
    let updateSurvey = await  survey.update(
      {makeLive:false},
     { where: { id: req.params.id }}
    )
    if(updateSurvey == 0){
      return res.status(200).send({
        message:"Error occured.Please check surveyId and published values"
      })
    }
    return res.status(200).send({
      message:"unpublish successfull"
    })
     }
     if(req.query.makeLive === "true"){
    let updateSurvey =  await  survey.update(
       {makeLive:true},
      { where: { id: req.params.id }}
     )
     if(updateSurvey == 0){
      return res.status(200).send({
        message:"Error occured.Please check surveyId and published values"
      })
    }
     return res.status(200).send({
      message:"publish successfull"
    })
      }

    }

 
  exports.viewSurvey = async(req,res) =>{
    try{
        console.log("view survey",req.params.surveyId)
        var Survey = await survey.findOne({
            where: { id: req.params.surveyId},
            include: [
              {
                model: db.question,
                as: "question",
                include: [
                  {
                    model: db.option,
                    as: "option",
                  },
                  {
                    model: db.response,
                    as: "response",
                    include: [
                      {
                        model: db.participant,
                        as: "participant",
                      },
                    ],
                  },
                ],
              },
            ]
          }) 
          console.log("survey",Survey)
          if(!Survey || Survey==null){
            return res.status(404).send({
              message:"survey Don't Exists"
            })
          }
          return res.status(200).send(Survey)
    }catch(err){
        return res.status(500).send({
            message:"Internal Server Error"
          })
    }
  }
  exports.sendSurveyLink = async (req, res) => {
    if (!req.body.surveylink || !req.body.useremail) {
      return res.status(400).send({
        message: "link and  email are required to send email"
      })
    }
    // let sendEmail = await email.sendEmail(req.body.surveylink, req.body.useremail)
    if (sendEmail) {
      return res.status(200).send("email sent ")
    } else {
      return res.status(200).send("email not sent")
    }
  }


  exports.submitSurvey = async (req, res) => {
    try {
      let surveyDetails = await survey.findOne({
        where: { id: req.query.surveyId },
      });
      console.log("doe",surveyDetails.dataValues)
      if (!surveyDetails || !surveyDetails.dataValues.makeLive) {
        return res.status(404).json({
          message: "Survey dont exists ",
        });
      }
      if (!req.body.email || !req.body.name) {
        return res.status(400).json({
          message: "email and name are required to submit response ",
        });
      }
      let emailExists = await service.checkEmail(
        req.body.email,
        req.query.surveyId
      );
      if (emailExists) {
        return res.status(400).send({
          message: "Response  Exists!",
        });
      }
      let Participant = await service.saveParticipant(
        req.body.email,
        req.body.name,
        req.query.surveyId
      );
      for (let i = 0; i < req.body.responses.length; i++) {
        await response.create({
          response: req.body.responses[i].response,
          participantId: Participant.dataValues.id,
          questionId: req.body.responses[i].id,
          surveyId:req.query.surveyId
        });
      }
  
      return res.status(200).send({
        message: "response save successfully",
      });
    } catch (err) {
      res.status(500).send(err);
    }
  };
  

  exports.surveyQuestions = async (req, res) => {
    try {
      console.log("view survey", req.query.surveyId);
      var Survey = await survey.findOne({
        where: { id: req.query.surveyId },
        include: [
          {
            model: db.question,
            as: "question",
            include: [
              {
                model: db.option,
                as: "option",
              },
            ],
          },
        ],
      });
      console.log("survey", Survey);
      if (!Survey || Survey.dataValues == null) {
        return res.status(404).send({
          message: "survey Don't Exists",
        });
      }
      if(!Survey.dataValues.makeLive){
        return res.status(404).send({
          message: "survey Don't Exists",
        });
      }
      return res.status(200).send(Survey);
    } catch (err) {
      return res.status(500).send({
        message: "Internal Server Error",
      });
    }
  };


  exports.generateSurveyReport = async (req, res) => {
    let surveyreports = []
    console.log("here")
    let survey_responses = await response.findAll({
      where: { surveyId: req.params.surveyId },
      include: ["question", "participant"],
    })
    console.log("sur",survey_responses)
    for (let i = 0; i < survey_responses.length; i++) {
      if (surveyreports.length == 0) {
        let object ={
          'email':survey_responses[i].participant.email,
          'name':survey_responses[i].participant.name
        }
        surveyreports.push( object )
      } else {
        email_found = false
        for (let j = 0; j < surveyreports.length; j++) {
          if (survey_responses[i].participant.email == surveyreports[j]['email']) {
            email_found = true
          }
        }
        if (!email_found) {
          let object ={
            'email':survey_responses[i].participant.email,
            'name':survey_responses[i].participant.name
          }
          surveyreports.push(object)
        }
      }
    }
    console.log("reo",surveyreports)
    for (let i = 0; i < survey_responses.length; i++) {
      
      for (let j = 0; j < surveyreports.length; j++) {
        if (survey_responses[i].participant.email == surveyreports[j]["email"]) {
          let question = survey_responses[i].question.questionTitle
          surveyreports[j][question] = survey_responses[i].response
        }
      }
    }
    console.log("surveyreports")
    return res.status(200).send(surveyreports);
  }