<?php
session_start();
include('include/config.php'); // Make sure DB is connected
error_reporting(E_ALL);
ini_set('display_errors', 1);

if (!isset($_SESSION['correct_count']) || !isset($_SESSION['wrong_count'])) {
    echo "<h3 style='color:red;'>Invalid access. Please attempt the quiz first.</h3>";
    exit;
}

$register_id = $_POST['register_id'] ?? 'Unknown';
$topic_id = $_POST['topic_id'] ?? 'Unknown';
$questions = $_SESSION['questions'] ?? [];
$answers = $_SESSION['answers'] ?? [];
$correct = $_SESSION['correct_count'] ?? 0;
$wrong = $_SESSION['wrong_count'] ?? 0;
$topic_id = $_SESSION['topic_id'];
$batch_name = $_SESSION['batch_name']; 
$mobile = $_SESSION['mobile']; 
$district = $_SESSION['district']; 

$totalQuestions = count($questions);
$answered = 0;

foreach ($answers as $answer) {
    if (!empty($answer)) {
        $answered++;
    }
}

$unanswered = $totalQuestions - $answered;

// Fetch teacher info
$teacher_id = 'N/A';
$teacher_name = 'N/A';

$stmt = $conn->prepare("SELECT teacher_id, teacher_name FROM batch_teachers WHERE register_id = ?");
$stmt->bind_param("s", $register_id);
$stmt->execute();
$stmt->bind_result($teacher_id, $teacher_name);
$stmt->fetch();
$stmt->close();
unset($_SESSION['questions'], $_SESSION['answers']);

?>


<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Quiz Result</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        body {
            background-color: #f0f2f5;
        }

        .result-container {
            background: #fff;
            margin-top: 80px;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.1);
        }

        @media (max-width: 768px) {
            .result-container {
                margin-top: 400px;
                font-size: 25px;
                padding: 30px 20px;
                border-radius: 12px;
            }

            h2 {
                font-size: 28px;
            }

            p {
                font-size: 18px;
            }
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-lg-6 col-md-8">
                <div class="result-container text-center">
                    <h2 class="mb-4">Quiz Result</h2>
                    <input type="hidden" id="topic_name" name="topic_name" value="<?= htmlspecialchars($topic_id) ?>">
                    <input type="hidden" id="batch_name" name="batch_name" value="<?= htmlspecialchars($batch_name) ?>">
                    <input type="hidden" id="mobile" name="mobile" value="<?= htmlspecialchars($mobile) ?>">
                    <input type="hidden" id="district" name="district" value="<?= htmlspecialchars($district) ?>">
                    <hr>
                    <input type="text" id="register_id" value="<?= htmlspecialchars($register_id) ?>" hidden>
                    <input type="text" id="topic_id" value="<?= htmlspecialchars($topic_id) ?>" hidden>
                    <input type="text" id="teacher_id" value="<?= htmlspecialchars($teacher_id) ?>" hidden>
                    <input type="text" id="teacher_name" value="<?= htmlspecialchars($teacher_name) ?>" hidden>

                    <p><strong>Total Questions:</strong> <?= $totalQuestions ?></p>
                    <p><strong>Answered:</strong> <?= $answered ?></p>
                    <p><strong>Unanswered:</strong> <?= $unanswered ?></p>

                    <p style="color:green;">Correct Answers: <?php echo $correct; ?></p>
                    <p style="color:red;">Wrong Answers: <?php echo $wrong; ?></p>
                    <!--                     
                    <a href="topicquest.php" class="btn btn-primary mt-3">Take Another Quiz</a> -->
                    <form action="feedback.php" method="POST" id="feedbackForm">
    <input type="hidden" name="mobile" value="<?= htmlspecialchars($mobile) ?>">
    <input type="hidden" name="batch_name" value="<?= htmlspecialchars($batch_name) ?>">
    <input type="hidden" name="topic_id" value="<?= htmlspecialchars($topic_id) ?>">
    <input type="hidden" name="district" value="<?= htmlspecialchars($district) ?>">
    <button type="submit" class="btn btn-success mt-3">Go to Feedback</button>
</form>
                </div>

            </div>
        </div>
    </div>
</body>

</html>