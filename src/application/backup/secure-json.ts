type ObjectState = "KEY_OR_END" | "COLON" | "VALUE" | "COMMA_OR_END";
type ArrayState = "VALUE_OR_END" | "COMMA_OR_END";

type JsonContext =
  | {
      readonly kind: "OBJECT";
      readonly keys: Set<string>;
      state: ObjectState;
    }
  | {
      readonly kind: "ARRAY";
      state: ArrayState;
    };

function isWhitespace(character: string): boolean {
  return (
    character === " " ||
    character === "\n" ||
    character === "\r" ||
    character === "\t"
  );
}

function readString(
  source: string,
  start: number,
): { readonly end: number; readonly value: string } {
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      const encoded = source.slice(start, index + 1);
      return { end: index + 1, value: JSON.parse(encoded) as string };
    }
  }
  throw new SyntaxError("Cadena JSON sin cerrar.");
}

function readPrimitive(source: string, start: number): number {
  let end = start;
  while (end < source.length) {
    const character = source[end]!;
    if (
      isWhitespace(character) ||
      character === "," ||
      character === "]" ||
      character === "}"
    ) {
      break;
    }
    end += 1;
  }
  if (end === start) {
    throw new SyntaxError("Valor JSON inválido.");
  }
  JSON.parse(source.slice(start, end));
  return end;
}

/**
 * Recorre el texto sin recursión y rechaza claves repetidas, incluidas las que
 * solo difieren por escapes JSON. JSON.parse conserva silenciosamente la última
 * clave y esa ambigüedad no es aceptable para una copia financiera.
 */
export function assertNoDuplicateJsonKeys(source: string): void {
  const stack: JsonContext[] = [];
  let rootComplete = false;
  let index = 0;

  const completeValue = (): void => {
    const parent = stack.at(-1);
    if (parent === undefined) {
      if (rootComplete) {
        throw new SyntaxError("El JSON contiene más de un valor raíz.");
      }
      rootComplete = true;
      return;
    }
    if (parent.kind === "OBJECT") {
      if (parent.state !== "VALUE") {
        throw new SyntaxError("Valor inesperado dentro de un objeto JSON.");
      }
      parent.state = "COMMA_OR_END";
      return;
    }
    if (parent.state !== "VALUE_OR_END") {
      throw new SyntaxError("Valor inesperado dentro de un arreglo JSON.");
    }
    parent.state = "COMMA_OR_END";
  };

  const beginValue = (): void => {
    const character = source[index]!;
    if (character === "{") {
      stack.push({ kind: "OBJECT", keys: new Set(), state: "KEY_OR_END" });
      index += 1;
      return;
    }
    if (character === "[") {
      stack.push({ kind: "ARRAY", state: "VALUE_OR_END" });
      index += 1;
      return;
    }
    if (character === '"') {
      const parsed = readString(source, index);
      index = parsed.end;
      completeValue();
      return;
    }
    index = readPrimitive(source, index);
    completeValue();
  };

  while (index < source.length) {
    if (isWhitespace(source[index]!)) {
      index += 1;
      continue;
    }
    const context = stack.at(-1);
    if (context === undefined) {
      if (rootComplete) {
        throw new SyntaxError("Contenido adicional después del valor JSON.");
      }
      beginValue();
      continue;
    }
    if (context.kind === "OBJECT") {
      if (context.state === "KEY_OR_END") {
        if (source[index] === "}") {
          stack.pop();
          index += 1;
          completeValue();
          continue;
        }
        if (source[index] !== '"') {
          throw new SyntaxError("Una clave JSON debe ser texto.");
        }
        const key = readString(source, index);
        if (context.keys.has(key.value)) {
          throw new SyntaxError("El JSON contiene una clave duplicada.");
        }
        context.keys.add(key.value);
        context.state = "COLON";
        index = key.end;
        continue;
      }
      if (context.state === "COLON") {
        if (source[index] !== ":") {
          throw new SyntaxError("Falta el separador de una propiedad JSON.");
        }
        context.state = "VALUE";
        index += 1;
        continue;
      }
      if (context.state === "VALUE") {
        beginValue();
        continue;
      }
      if (source[index] === ",") {
        context.state = "KEY_OR_END";
        index += 1;
        continue;
      }
      if (source[index] === "}") {
        stack.pop();
        index += 1;
        completeValue();
        continue;
      }
      throw new SyntaxError("Objeto JSON incompleto.");
    }
    if (context.state === "VALUE_OR_END") {
      if (source[index] === "]") {
        stack.pop();
        index += 1;
        completeValue();
        continue;
      }
      beginValue();
      continue;
    }
    if (source[index] === ",") {
      context.state = "VALUE_OR_END";
      index += 1;
      continue;
    }
    if (source[index] === "]") {
      stack.pop();
      index += 1;
      completeValue();
      continue;
    }
    throw new SyntaxError("Arreglo JSON incompleto.");
  }

  if (!rootComplete || stack.length > 0) {
    throw new SyntaxError("JSON incompleto.");
  }
}
