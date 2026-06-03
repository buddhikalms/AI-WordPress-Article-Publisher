<?php

if (!defined('ABSPATH')) {
	exit;
}

final class AI_Article_Publisher_Error extends Exception
{
	/** @var int */
	public $status;

	/** @var mixed */
	public $details;

	/**
	 * @param string $message
	 * @param int    $status
	 * @param mixed  $details
	 */
	public function __construct($message, $status = 400, $details = null)
	{
		parent::__construct($message);
		$this->status = (int) $status;
		$this->details = $details;
	}
}
