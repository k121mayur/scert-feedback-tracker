<?php
session_start();
header('Content-Type: application/json');
include('include/config.php');
date_default_timezone_set("Asia/Kolkata");

$topic_id = $_GET['topic_id'] ?? '';
$mobile = $_GET['mobile'] ?? '';
$today = date("Y-m-d");

$response = ['status' => 'error', 'message' => 'Something went wrong'];

if (empty($topic_id)) {
    $response['message'] = 'Missing topic ID';
    echo json_encode($response);
    exit;
}

if (empty($mobile)) {
    $response['message'] = 'Missing mobile number';
    echo json_encode($response);
    exit;
}

// ✅ Check if already attempted
$checkStmt = $conn->prepare("SELECT id FROM paper_trainers WHERE topic_id = ? AND mobile = ?");
$checkStmt->bind_param("ss", $topic_id, $mobile);
$checkStmt->execute();
$checkResult = $checkStmt->get_result();

if ($checkResult->num_rows > 0) {
    $response['message'] = "You have already attempted this exam.";
    echo json_encode($response);
    exit;
}

// ✅ Optimized random fetch
$randStmt = $conn->prepare("SELECT MAX(id) as max_id FROM questions WHERE topic_id = ?");
$randStmt->bind_param("s", $topic_id);
$randStmt->execute();
$randResult = $randStmt->get_result()->fetch_assoc();
$max_id = $randResult['max_id'] ?? 0;

$random_base = mt_rand(1, $max_id);

$qStmt = $conn->prepare("SELECT question, option_a, option_b, option_c, option_d FROM questions 
                         WHERE topic_id = ? AND id >= ? LIMIT 10");
$qStmt->bind_param("si", $topic_id, $random_base);
$qStmt->execute();
$qResult = $qStmt->get_result();

$questions = [];
while ($row = $qResult->fetch_assoc()) {
    $questions[] = $row;
}

if (count($questions) === 0) {
    $response['message'] = "No questions found for the given Topic Id.";
} else {
    $_SESSION['questions'] = array_column($questions, 'question');
    $response['status'] = 'success';
    $response['questions'] = $questions;
}

echo json_encode($response);
exit;
?>
