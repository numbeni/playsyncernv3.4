interface ApiErrorLike {
  status: number;
  data?: unknown;
}

function isApiErrorLike(error: unknown): error is ApiErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as ApiErrorLike).status === "number"
  );
}

export interface ApiErrorContext {
  operation?: "delete";
}

export function formatApiError(error: unknown, context?: ApiErrorContext): string {
  if (isApiErrorLike(error)) {
    const status = error.status;
    const data = error.data as { error?: string; message?: string } | undefined;
    const serverMessage = data?.error ?? data?.message ?? "";

    if (status === 400) {
      return "اطلاعات وارد شده معتبر نیست. لطفاً عنوان و پلتفرم را بررسی کنید.";
    }

    if (status === 404) {
      return "بازی مورد نظر یافت نشد.";
    }

    if (status === 409) {
      // Delete-specific: backend rejected due to existing account/order history.
      if (context?.operation === "delete") {
        return "این بازی سابقه اکانت دارد و قابل حذف نیست. برای حفظ سوابق، بازی را غیرفعال کنید.";
      }
      const lowered = serverMessage.toLowerCase();
      if (lowered.includes("platform") || lowered.includes("پلتفرم")) {
        return "پس از ثبت اکانت، امکان تغییر پلتفرم وجود ندارد.";
      }
      if (
        lowered.includes("title") ||
        lowered.includes("عنوان") ||
        lowered.includes("duplicate")
      ) {
        return "بازی با این عنوان قبلاً ثبت شده است.";
      }
      return "امکان ثبت این تغییر وجود ندارد.";
    }

    if (status >= 500) {
      return "خطای سرور رخ داده است. لطفاً دوباره تلاش کنید.";
    }

    return "عملیات با خطا مواجه شد.";
  }

  if (error instanceof Error && error.message.toLowerCase().includes("network")) {
    return "اتصال به شبکه برقرار نشد. لطفاً وضعیت اینترنت را بررسی کنید.";
  }

  if (error instanceof Error) {
    return "خطا در ارتباط با سرور رخ داده است.";
  }

  return "خطای ناشناخته رخ داده است.";
}
