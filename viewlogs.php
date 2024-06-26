<?php
    session_start();

    // Set your hashed password
    $hashed_password = '$2a$12$y3XrdujO9rE544vJsXcTZ.lKat6r2VfTBZVh7BIo2P.Xu7FRVuZPi';

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
        if (password_verify($_POST['password'], $hashed_password)) {
            $_SESSION['logged_in'] = true;
        } else {
            $error = "Incorrect password. Please try again.";
        }
    }

    if (!isset($_SESSION['logged_in'])) {
        ?>
        <form action="" method="post">
            Password: <input type="password" name="password">
            <input type="submit" value="Login">
        </form>
        <?php
        if (isset($error)) {
            echo "<p>$error</p>";
        }
        exit;
    }

    $logDir = '/homepages/46/d339340751/htdocs/logs';
    $logFiles = array_reverse(glob("$logDir/*.*"));

    $accessLogs = [];

    foreach ($logFiles as $logFile) {
        if (strpos(basename($logFile), 'access.log') === 0 && basename($logFile) !== 'access.log.current') {
            $accessLogs[] = $logFile;
        }
    }
?>

<?php
session_start();

// Set your hashed password
$hashed_password = 'your_hash_here'; // Replace this with your actual hash

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if (password_verify($_POST['password'], $hashed_password)) {
        $_SESSION['logged_in'] = true;
    } else {
        $error = "Incorrect password. Please try again.";
    }
}

if (!isset($_SESSION['logged_in'])) {
    ?>
    <form action="" method="post">
        Password: <input type="password" name="password">
        <input type="submit" value="Login">
    </form>
    <?php
    if (isset($error)) {
        echo "<p>$error</p>";
    }
    exit;
}

// Set the correct absolute path to the logs directory
$logDir = '/homepages/46/d339340751/htdocs/logs';

// Display logs if password is correct
$logFiles = array_reverse(glob("$logDir/*")); // Get all files

$accessLogs = [];

foreach ($logFiles as $logFile) {
    if (strpos(basename($logFile), 'access.log') === 0 && basename($logFile) !== 'access.log.current') {
        $accessLogs[] = $logFile;
    }
}

?>

<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Log Viewer</title>
        <style>
            table {
                width: 100%;
                border-collapse: collapse;
            }
            th, td {
                padding: 8px;
                text-align: left;
                border-bottom: 1px solid #ddd;
                white-space: nowrap;
            }
            th {
                background-color: #f2f2f2;
            }
            tr:nth-child(even) {
                background-color: #f9f9f9;
            }
            tr:hover {
                background-color: #e9e9e9;
            }
            .method { color: #FF5722; }
            .url { color: #1976D2; }
            .protocol { color: #388E3C; }
            .status { color: #E64A19; }
            .size { color: #7B1FA2; }
            .referer { color: #FF9800; }
            .user-agent { color: #9C27B0; }
        </style>
    </head>
    <body>
        <h2>Access Logs</h2>
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Datetime</th>
                        <th>IP Address</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    if (!empty($accessLogs)) {
                        foreach ($accessLogs as $logFile) {
                            $lines = [];
                            $fp = gzopen($logFile, 'r');
                            if ($fp) {
                                while (!gzeof($fp)) {
                                    $lines[] = gzgets($fp);
                                }
                                gzclose($fp);
                            }
                            $lines = array_reverse($lines);
                            foreach ($lines as $line) {
                                $parts = explode(' ', $line);
                                $ip = $parts[0];
                                $datetime = substr($parts[3], 1) . ' ' . $parts[4];
                                $method = $parts[5];
                                $url = $parts[6];
                                $protocol = $parts[7];
                                $status = $parts[8];
                                $size = $parts[9];
                                $referer = $parts[10];
                                $userAgent = implode(' ', array_slice($parts, 11));
                                echo "<tr>";
                                echo "<td>" . htmlspecialchars($datetime) . "</td>";
                                echo "<td>" . htmlspecialchars($ip) . "</td>";
                                echo "<td>";
                                echo "<span class='method'>" . htmlspecialchars($method) . "</span> ";
                                echo "<span class='url'>" . htmlspecialchars($url) . "</span> ";
                                echo "<span class='protocol'>" . htmlspecialchars($protocol) . "</span> ";
                                echo "<span class='status'>" . htmlspecialchars($status) . "</span> ";
                                echo "<span class='size'>" . htmlspecialchars($size) . "</span> ";
                                echo "<span class='referer'>" . htmlspecialchars($referer) . "</span> ";
                                echo "<span class='user-agent'>" . htmlspecialchars($userAgent) . "</span>";
                                echo "</td>";
                                echo "</tr>";
                            }
                        }
                    } else {
                        echo "<tr><td colspan='3'>No Access log files found.</td></tr>";
                    }
                    ?>
                </tbody>
            </table>
        </div>
    </body>
</html>
