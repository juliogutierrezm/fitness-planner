const DEFAULT_FALLBACK = 'No pudimos completar la solicitud. Intenta de nuevo.';

const ERROR_MAP: Record<string, string> = {
  UserNotFoundException: 'No encontramos una cuenta con ese correo.',
  NotAuthorizedException: 'El correo o la contraseña no son correctos.',
  UserNotConfirmedException: 'Tu cuenta aún no está confirmada. Revisa tu correo.',
  SignedInUserAlreadyAuthenticatedException: 'Ya hay una sesión activa. Redirigiendo…',
  UsernameExistsException: 'Ese correo ya está registrado. Inicia sesión.',
  CodeMismatchException: 'El código ingresado no es válido.',
  ExpiredCodeException: 'El código ha expirado. Solicita uno nuevo.',
  InvalidPasswordException: 'La contraseña no cumple los requisitos de seguridad.',
  LimitExceededException: 'Demasiados intentos. Intenta más tarde.',
  TooManyFailedAttemptsException: 'Demasiados intentos fallidos. Intenta más tarde.',
  TooManyRequestsException: 'Se alcanzó el límite de solicitudes. Intenta más tarde.',
  PasswordResetRequiredException: 'Debes restablecer tu contraseña antes de continuar.',
  InvalidParameterException: 'Revisa los datos ingresados e intenta nuevamente.',
  UserLambdaValidationException: 'No pudimos validar la información. Intenta nuevamente.',
  UnexpectedLambdaException: 'Hubo un problema al validar tu información.'
};

export function getAuthErrorName(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error !== 'object') {
    return null;
  }

  const { name, code, __type } = error as { name?: string; code?: string; __type?: string };
  const raw = name || code || __type;
  if (!raw) {
    return null;
  }

  const normalized = raw.includes('#') ? raw.split('#').pop() : raw;
  return normalized || raw;
}

export function mapCognitoError(error: unknown, fallback: string = DEFAULT_FALLBACK): string {
  const name = getAuthErrorName(error);
  if (name && ERROR_MAP[name]) {
    return ERROR_MAP[name];
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: string }).message;
    if (message && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}
