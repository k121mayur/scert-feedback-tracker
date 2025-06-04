<?php
session_start();
include_once 'include/config.php';

if (isset($_POST['upload'])) {
    if ($_FILES['file']['name']) {
        $filename = $_FILES['file']['tmp_name'];
        $csvData = file_get_contents($filename);
        $_SESSION['csv_data'] = base64_encode($csvData);
        unset($_SESSION['checked_data']); // Reset on new upload
    }
}

if (isset($_POST['check'])) {
    if (isset($_SESSION['csv_data'])) {
        $csvData = base64_decode($_SESSION['csv_data']);
        $file = fopen('php://memory', 'r+');
        fwrite($file, $csvData);
        rewind($file);

        $output = [];
        $headers = fgetcsv($file);
        $headers[] = 'Exists';

        // Check if teachers table exists
        $tableCheck = mysqli_query($conn, "SHOW TABLES LIKE 'teachers'");
        $tableExists = mysqli_num_rows($tableCheck) > 0;

        while (($data = fgetcsv($file)) !== FALSE) {
            $paymentId = mysqli_real_escape_string($conn, trim($data[3]));
            $exists = 'No';

            if ($tableExists && !empty($paymentId)) {
                $check = mysqli_query($conn, "SELECT id FROM teachers WHERE pay_id = '$paymentId'");
                if (mysqli_num_rows($check) > 0) {
                    $exists = 'Yes';
                }
            }

            $data[] = $exists;
            $output[] = $data;
        }

        fclose($file);

        // Save the output for download
        ob_start();
        $outStream = fopen("php://output", 'w');
        fputcsv($outStream, $headers);
        foreach ($output as $row) {
            fputcsv($outStream, $row);
        }
        fclose($outStream);
        $_SESSION['checked_data'] = base64_encode(ob_get_clean());
    }
}

if (isset($_POST['download']) && isset($_SESSION['checked_data'])) {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="checked_pay_id.csv"');
    echo base64_decode($_SESSION['checked_data']);
    exit;
}
?>

<!-- Upload Form -->
<form method="post" enctype="multipart/form-data">
    <label>Select CSV file:</label>
    <input type="file" name="file" accept=".csv" required>
    <button type="submit" name="upload">Upload</button>
</form>

<!-- Check Button -->
<?php if (isset($_SESSION['csv_data'])): ?>
    <form method="post">
        <button type="submit" name="check">Check pay_id Exists</button>
    </form>
<?php endif; ?>

<!-- Download Button -->
<?php if (isset($_SESSION['checked_data'])): ?>
    <form method="post">
        <button type="submit" name="download">Download Updated CSV</button>
    </form>
<?php endif; ?>

<!-- Display Table -->
<?php
if (isset($output) && !empty($output)) {
    echo "<table border='1' cellpadding='5'>";
    echo "<tr>";
    foreach ($headers as $header) {
        echo "<th>" . htmlspecialchars($header) . "</th>";
    }
    echo "</tr>";
    foreach ($output as $row) {
        echo "<tr>";
        foreach ($row as $col) {
            echo "<td>" . htmlspecialchars($col) . "</td>";
        }
        echo "</tr>";
    }
    echo "</table>";
}
?>
