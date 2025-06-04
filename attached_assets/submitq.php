<?php
session_start();
include('include/config.php');
date_default_timezone_set("Asia/Kolkata");
error_reporting(E_ALL);
ini_set('display_errors', 1);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $mobile = $_POST['mobile'] ?? '';
    $batch_name = $_POST['batch_name'] ?? '';
    $district = $_POST['district'] ?? '';
    $questions = $_POST['questions'] ?? [];
    $answers = $_POST['answers'] ?? [];
    $topic_id = $_POST['topic_id'] ?? '';
    $paper_date = date("Y-m-d H:i:s");

    if (empty($mobile) || empty($questions) || empty($answers)) {
        die("Invalid data submitted.");
    }

    $topicStmt = $conn->prepare("SELECT service_type, training_group FROM questions WHERE topic_id = ? LIMIT 1");
    $topicStmt->bind_param("s", $topic_id);
    $topicStmt->execute();
    $topicResult = $topicStmt->get_result();
    $topicRow = $topicResult->fetch_assoc();

    $service_type = $topicRow['service_type'] ?? '';
    $training_group = $topicRow['training_group'] ?? '';

    // ✅ Optimized batch fetch of correct answers
    $in = implode(',', array_fill(0, count($questions), '?'));
    $types = str_repeat('s', count($questions));
    $stmt = $conn->prepare("SELECT question, correct_option FROM questions WHERE question IN ($in)");
    $stmt->bind_param($types, ...$questions);
    $stmt->execute();
    $result = $stmt->get_result();

    $correct_lookup = [];
    while ($row = $result->fetch_assoc()) {
        $correct_lookup[$row['question']] = $row['correct_option'];
    }

    $insertStmt = $conn->prepare("INSERT INTO paper_trainers 
        (question, answer, correct_option, marks, paper_date, mobile, topic_id, service_type, training_group, batch_name, district) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $correct_count = 0;
    $wrong_count = 0;

    foreach ($questions as $index => $question) {
        $answer = $answers[$index] ?? '';
        $correct_option = $correct_lookup[$question] ?? '';
        $marks = ($answer === $correct_option) ? 1 : 0;

        if ($marks === 1) {
            $correct_count++;
        } else {
            $wrong_count++;
        }

        $insertStmt->bind_param("sssssssssss", $question, $answer, $correct_option, $marks, $paper_date, $mobile, $topic_id, $service_type, $training_group, $batch_name, $district);
        $insertStmt->execute();
    }

    $_SESSION['mobile'] = $mobile;
    $_SESSION['questions'] = $questions;
    $_SESSION['answers'] = $answers;
    $_SESSION['correct_count'] = $correct_count;
    $_SESSION['wrong_count'] = $wrong_count;
    $_SESSION['topic_id'] = $topic_id;
    $_SESSION['batch_name'] = $batch_name;
    $_SESSION['district'] = $district;

    header("Location: resultq.php");
    exit;
} else {
    echo "Invalid request method.";
}
?>
