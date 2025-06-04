<?php
// Include the configuration file
include_once('include/config.php');
mysqli_set_charset($conn, "utf8"); 
$mobile = $_POST['mobile'] ?? '';
$batch_name = $_POST['batch_name'] ?? '';
$topic_id = $_POST['topic_id'] ?? '';
$district = $_POST['district'] ?? '';

?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Feedback Page</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {
      background: #f2f2f2;
    }
    .feedback-form {
      max-width: 800px;
      margin: 50px auto;
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0px 0px 10px 0px #0000001a;
    }
    @media (max-width: 768px) {
      .feedback-form {
        margin: 20px;
        padding: 20px;
      }
    }
  </style>
</head>
<body>

<div class="container">
  <div class="feedback-form">
    <h2 class="text-center mb-4">We value your feedback</h2>
    
      <form id="form" method="post" class="mt-4 border p-4 rounded" onsubmit="return validateAndAdd()">
      
      <!-- First Row: Date, Trainer Name, Mobile No -->
     <div class="row mb-3">
      <!-- Mobile Number -->
   <div class="col-12 col-md-4 mb-3 mb-md-0">
    <label for="mobile_no" class="form-label"><strong>Mobile No</strong></label>
    <input type="text" name="mobile_no" id="mobile_no" maxlength="10" class="form-control" onchange=" checkTopicExists()" readonly value="<?= htmlspecialchars($mobile) ?>" required>
  </div>
  

  
<input type="hidden" id="topic_name" name="topic_name" value="<?= htmlspecialchars($topic_id) ?>">
<input type="hidden" id="batch_name" name="batch_name" value="<?= htmlspecialchars($batch_name) ?>">
<input type="hidden" id="district" name="district" value="<?= htmlspecialchars($district) ?>">

</div>
<div class="row mb-3" id="feedback_questions_container">
  <div class="col-12">
    
    <div id="questions_container"></div>
  </div>
</div>

      
      <!-- Submit Button -->
      <div class="d-grid gap-2 d-md-flex justify-content-md-center">
  <button type="submit" class="btn btn-primary">Submit Feedback</button>
</div>
      
    </form>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script type="text/javascript">
    function checkTopicExists() {
    var topicName = document.getElementById('topic_name').value;
    var mobileNo = document.getElementById('mobile_no').value;

    if (topicName === "" || mobileNo === "") return; // No need to check if fields are empty

    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'check_topic.php?topic=' + encodeURIComponent(topicName) + '&mobile=' + encodeURIComponent(mobileNo), true);
    xhr.onload = function() {
        if (xhr.status === 200) {
            if (xhr.responseText === "exists") {
                // Clear the Topic Name and Mobile No fields
                document.getElementById('topic_name').value = '';
                document.getElementById('mobile_no').value = '';
                
                // Alert the user
                alert("This feedback already exists for the mobile and topic.");
                
                // Focus on the Mobile Number field
                document.getElementById('mobile_no').focus();
            }
        }
    };
    xhr.send();
}



function fetchQuestions() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'get_feedbackq.php', true);
    xhr.onload = function() {
        if (xhr.status === 200) {
            var questions = JSON.parse(xhr.responseText);
            var questionsContainer = document.getElementById('questions_container');
            questionsContainer.innerHTML = '';  // Clear previous content

            if (questions.length > 0) {
                var html = '';
                // Store questions in a global variable
                window.feedbackQuestions = questions;  // Store questions for later reference
                for (var i = 0; i < questions.length; i++) {
                    html += '<div class="mb-3">';
                    html += '<label><strong>' + (i + 1) + '. </strong>' + questions[i].feedback_ques + '</label><br>'; // Add Sr. No.
                    for (var j = 1; j <= 5; j++) {
                        html += '<input type="radio" name="question_' + i + '" value="' + questions[i]['option' + j] + '"> ' + questions[i]['option' + j] + '<br>';
                    }
                    html += '</div>';
                }
                questionsContainer.innerHTML = html;
                document.getElementById('feedback_questions_container').style.display = 'block';  // Show questions container
            }
        }
    };
    xhr.send();
}

   

    function validateAndAdd() {
    var regMobile = /^[6-9]\d{9}$/; // Starts with 6-9 and exactly 10 digits
    var mobile = document.getElementById('mobile_no').value;

    // Validate mobile number
    if (!regMobile.test(mobile)) {
        alert("Please enter a valid 10-digit mobile number starting with 6 to 9.");
        document.getElementById('mobile_no').focus();
        return false;
    }

    // Collect all the questions and their answers
    var questions = [];
    var feedbackAnswers = [];
    var questionElements = document.querySelectorAll('input[type="radio"]:checked');
    
    // Check if all questions have been answered
    if (questionElements.length !== window.feedbackQuestions.length) {
        alert("Please answer all the questions.");
        return false;
    }

    questionElements.forEach(function (element, index) {
        // Store only the question text
        var questionText = window.feedbackQuestions[index].feedback_ques;  // Use the feedback_ques property
        questions.push(questionText); // Push only the question text
        feedbackAnswers.push(element.value); // Get the value of the selected radio button (answer)
    });

    // Log the data for debugging
    
    console.log("Topic Name: " + document.getElementById('topic_name').value);
    
    console.log("Mobile No: " + mobile);
    console.log("Questions: ", questions);  // Now contains only question text
    console.log("Feedback Answers: ", feedbackAnswers);

    // Prepare form data to send via AJAX
    var formData = new FormData();
  
    formData.append("topic_name", document.getElementById('topic_name').value);
    formData.append("batch_name", document.getElementById('batch_name').value); 
    formData.append("district", document.getElementById('district').value); 
    formData.append("mobile_no", mobile);
    formData.append("questions", JSON.stringify(questions)); // Send only question texts as JSON
    formData.append("feedback_answers", JSON.stringify(feedbackAnswers)); // Send answers as JSON

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'insert_feedback.php', true);
    xhr.onload = function() {
        if (xhr.status === 200) {
            // Check the server response (which is the alert message)
            if (xhr.responseText === "success") {
                 window.location.href = 'thank_you.php';
            } else {
                alert('Error: ' + xhr.responseText); // Display error message if there's any
            }
        }
    };
    xhr.send(formData);

    return false; // Prevent form submission to allow AJAX
}


function validate(input) {
            input.value = input.value.replace(/[^0-9]/g, ''); // Allow only numbers
        }

window.onload = function() {
    fetchQuestions();
};
</script>
</body>
</html>
