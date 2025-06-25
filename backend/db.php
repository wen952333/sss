<?php
$db = new PDO("mysql:host=localhost;dbname=ssgame;charset=utf8", "dbuser", "dbpass");
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
