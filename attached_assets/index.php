<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

session_start();
include('include/config.php');



// Default empty questions
$_SESSION['questions'] = [];
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Question Set</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background-color: #f8f9fa;
            margin: auto;
            font-family: 'Poppins', sans-serif;
        }

        .question-container {
            background: #fff;
            padding: 50px;
            border-radius: 25px;
            box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.1);
        }

        .submit-btn {
            text-align: center;
            margin-top: 20px;
        }

        .timer {
            font-size: 30px;
            font-weight: bold;
            text-align: right;
            color: red;
        }

        input[type="radio"] {
            border: 2px solid rgb(138, 138, 138);
            border-radius: 50%;
            padding: 10px;
            transition: all 0.3s ease;
        }

        input[type="radio"]:checked {
            background-color: #007bff;
            border-color: #007bff;
        }

        @media (max-width: 767px) {
            body {
                font-size: 36px;
                padding: 30px;
            }

            .container1 {
                padding: 40px;
            }

            .question-container {
                padding: 60px;
                font-size: 45px;
            }

            .form-control,
            .form-select {
                font-size: 40px;
                padding: 30px;
            }

            .timer {
                font-size: 50px;
            }

            .btn {
                font-size: 42px;
                padding: 25px;
                width: 100%;
            }

            label {
                font-size: 36px;
                margin-bottom: 15px;
            }

            select,
            input {
                width: 100%;
                padding: 30px;
            }

            small {
                font-size: 28px;
                color: red;
            }
        }

        @media (min-width: 768px) and (max-width: 1024px) {
            .container1 {
                padding: 50px;
            }

            .question-container {
                padding: 70px;
                font-size: 38px;
            }

            .form-control,
            .form-select {
                font-size: 34px;
                padding: 25px;
            }

            .btn {
                font-size: 36px;
                padding: 15px;
                width: 100%;
            }

            .timer {
                font-size: 38px;
            }
        }

        @media (min-width: 1024px) {
            body {
                font-size: 18px;
                padding: 50px;
            }

            .container1 {
                padding: 60px;
            }

            .question-container {
                padding: 50px;
                font-size: 20px;
            }

            .form-control,
            .form-select {
                font-size: 20px;
                padding: 20px;
            }

            .btn {
                font-size: 20px;
                padding: 15px 30px;
                width: auto;
            }

            .timer {
                font-size: 25px;
            }

            label {
                font-size: 20px;
                margin-bottom: 10px;
            }

            select,
            input {
                width: 100%;
                padding: 15px;
            }

            small {
                font-size: 18px;
                color: red;
            }

            .question-container {
                max-width: 900px;
                margin: auto;
            }
        }
    </style>
</head>

<body>
    <div class="container1">
        <div class="question-container">
            <h1 style="font-size: 70px;" class="text-center"><b>Question Set</b></h1><br>

            <!-- Topic ID & Registration ID Input -->
            <div class="mb-5">
          

                <div class="mb-4">
                    <label for="mobile" class="form-label">Mobile Number</label>
                    <input type="text" id="mobile" name="mobile" class="form-control" placeholder="Enter Mobile" maxlength="10" oninput="this.value = this.value.replace(/[^0-9]/g, '')">
                </div>
                  <div class="mb-4">
                    <label for="topic_id" class="form-label">Topic Id</label>
                   <input type="text" id="topic_id" name="topic_id" class="form-control"  readonly>
                </div>
                 
                    
                     <input type="hidden" id="batch_name" name="batch_name" class="form-control"  readonly>
                     <input type="hidden" id="district" name="district" class="form-control"  readonly>
                
                

                <small id="errorMessage" class="form-text text-danger"></small>
                <br>
                <button class="btn btn-primary" id="loadQuestionsBtn" onclick="loadQuestions()">Start Exam</button>
            </div>

            <form action="submitq.php" method="POST" id="quizForm">
                <div class="timer" id="timer">Remaining Time: 00:00</div><br>
                <div id="questionsContainer"></div>
            </form>

        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
  document.getElementById('mobile').addEventListener('input', function () {
    var mobile = this.value;

    if (mobile.length === 10) {
        fetch('get_topic_id.php?mobile=' + mobile)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('topic_id').value = data.topic_id;
                    document.getElementById('batch_name').value = data.batch_name;
                    document.getElementById('district').value = data.district;
                } else {
                    document.getElementById('topic_id').value = '';
                    document.getElementById('batch_name').value = '';
                    document.getElementById('district').value = '';
                    document.getElementById('mobile').value = '';
                    alert('Question paper is no longer active.');
                }
            })
            .catch(error => {
                console.error('Error fetching topic ID:', error);
            });
    } else {
        document.getElementById('topic_id').value = '';
        document.getElementById('batch_name').value = '';
        document.getElementById('district').value = '';
    }
});



        function startTimer(timeLeft) {
            const timerElement = document.getElementById("timer");
            const submitButton = document.getElementById("submitBtn");
            submitButton.disabled = false;

            const countdown = setInterval(() => {
                let minutes = Math.floor(timeLeft / 60);
                let seconds = timeLeft % 60;
                timerElement.textContent = `Remaining Time: ${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

                if (timeLeft <= 0) {
                    clearInterval(countdown);
                    alert("Time's up! Your answers are now locked. Please submit to view results.");

                    // Prevent changing answers but still submit them
                    document.querySelectorAll('input[type="radio"]').forEach(input => {
                        input.onclick = function() {
                            return false;
                        };
                    });

                    submitButton.disabled = false;
                }

                timeLeft--;
            }, 1000);
        }

        function loadQuestions() {
            const topicId = document.getElementById("topic_id").value.trim();
            const mobile = document.getElementById("mobile").value.trim(); // Get the mobile number from an input field
            const errorMessage = document.getElementById("errorMessage");

            errorMessage.textContent = "";
            if (topicId === "") {
                errorMessage.textContent = "Please enter Valid Mobile No.";
                return;
            }

            if (mobile === "") {
                errorMessage.textContent = "Please enter your mobile number.";
                return;
            }

            fetch(`fetch.php?topic_id=${topicId}&mobile=${mobile}`)
                .then(res => res.json())
                .then(data => {
                    if (data.status === "error") {
                        errorMessage.textContent = data.message;
                        return;
                    }

                    let questionsContainer = document.getElementById("questionsContainer");
                    questionsContainer.innerHTML = "";

                    data.questions.forEach((q, index) => {
                        let questionHtml = `
                <div class="mb-4">
                    <p class="fw-bold">Q${index + 1}. ${q.question}</p>
                    <input type="hidden" name="questions[${index}]" value="${q.question}">
                    <div class="row g-2">
                        ${['option_a', 'option_b', 'option_c', 'option_d'].map((opt, i) => `
                            <div class="col-sm-12 col-md-6">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="answers[${index}]" id="q${index}_option${i}" value="${['A', 'B', 'C', 'D'][i]}">
                                    <label class="form-check-label" for="q${index}_option${i}"><strong>${['A', 'B', 'C', 'D'][i]}.</strong> ${q[opt]}</label>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
                        questionsContainer.innerHTML += questionHtml;
                    });

                    questionsContainer.innerHTML += `
            <input type="hidden" name="topic_id" value="${topicId}">
            <input type="hidden" name="mobile" value="${mobile}">
            <input type="hidden" name="batch_name" value="${document.getElementById('batch_name').value}">
            <input type="hidden" name="district" value="${document.getElementById('district').value}">

            
            <div class="submit-btn">
                <button type="submit" id="submitBtn" class="btn btn-success" disabled>Submit Answers</button>
            </div>
        `;

                    startTimer(600); // 10 minutes for demo, adjust as needed
                    document.getElementById("loadQuestionsBtn").disabled = true;

                    // 👉 Disable input fields after loading questions
                    document.getElementById("topic_id").disabled = true;
                    document.getElementById("mobile").disabled = true;
                })
                .catch(err => {
                    errorMessage.textContent = "Error loading questions.";
                    console.error(err);
                });
        }
         document.addEventListener("DOMContentLoaded", function () {
        const form = document.getElementById("quizForm");

        form.addEventListener("submit", function () {
            const submitBtn = document.getElementById("submitBtn");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Submitting..."; // Optional: change button text
            }
        });
    });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>

</html>