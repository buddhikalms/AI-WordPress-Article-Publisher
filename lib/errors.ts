import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "HttpError";
  }
}

export const getErrorMessage = (
  error: unknown,
  fallback = "Unexpected server error.",
): string => {
  if (error instanceof HttpError) {
    return error.message;
  }
  if (error instanceof ZodError) {
    return "Validation failed.";
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
};

export const toErrorResponse = (
  error: unknown,
  fallback = "Unexpected server error.",
) => {
  if (error instanceof HttpError) {
    return NextResponse.json(
      {
        error: error.message,
        details: error.details ?? null,
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: error.flatten(),
      },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: getErrorMessage(error, fallback),
    },
    { status: 500 },
  );
};

