<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Log Viewer</title>
    </head>
    <body>
        <h1>Server Log Files</h1>
        <?php
            session_start();

            // Set your hashed password (output from Ruby bcrypt)
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

            // Display logs if password is correct
            $logDir = __DIR__;  // Adjust the path as necessary
            $logFiles = array_reverse(glob("$logDir/*.gz")); // Adjust the path as necessary

            foreach ($logFiles as $logFile) {
                echo "<h2>" . basename($logFile) . "</h2>";
                $fp = gzopen($logFile, 'r');
                if ($fp) {
                    echo '<pre>';
                    while (!gzeof($fp)) {
                        echo gzgets($fp);
                    }
                    echo '</pre>';
                    gzclose($fp);
                } else {
                    echo "<p>Error opening file.</p>";
                }
            }
        ?>
    </body>
</html>
