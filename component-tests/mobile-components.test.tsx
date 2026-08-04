import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import NewGoalScreen from "../src/app/new-goal";
import GoalDetailScreen from "../src/app/goal/[id]";
import RegisterMovementScreen from "../src/app/goal/[id]/register";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockPush = jest.fn();
let mockMovementId: string | undefined;
const mockCreateSimpleGoal = jest.fn(async () => undefined);
const mockCreateAdvancedGoal = jest.fn(async () => undefined);
const mockRegisterMovement = jest.fn(async () => ({ id: "goal-1" }));
const mockReviseMovement = jest.fn(async () => ({ id: "goal-1" }));
const mockReviseAdvancedContribution = jest.fn(async () => mockGoalDetail);
const mockConvertAdvancedGoalToSimple = jest.fn(async () => mockGoalDetail);
const mockVoidMovement = jest.fn(async () => mockGoalDetail);
const mockGetGoal = jest.fn(async () => mockGoalDetail);

const mockGoalDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Emergencias",
  projectionMode: "ADVANCED" as const,
  status: "ACTIVE" as const,
  periodicAmount: "200000",
  periodicity: "MONTHLY" as const,
  numberOfPeriods: 6,
  startDate: "2026-01-01",
  projectedEndDate: "2026-07-01",
  projectedTotal: "1200000",
  projectedContributions: "1200000",
  projectedYield: "0",
  actualBalance: "200000",
  targetAmount: "1500000",
  projectionBlocked: false,
  configurationRevisionNumber: 1,
  configurationEffectiveFrom: "2026-01-01",
  initialBalance: "0",
  actualContributions: "200000",
  actualExtraContributions: "0",
  actualWithdrawals: "0",
  actualYield: "0",
  adjustments: "0",
  movements: [
    {
      id: "00000000-0000-4000-8000-000000000010",
      type: "CONTRIBUTION" as const,
      amount: "200000",
      effectiveDate: "2026-02-01",
      status: "ACTIVE" as const,
    },
  ],
  latestClose: {
    periodEnd: "2026-03-01",
    closingBalance: "200000",
  },
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({
    id: "00000000-0000-4000-8000-000000000001",
    ...(mockMovementId === undefined ? {} : { movementId: mockMovementId }),
  }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import("react")>("react");
    React.useEffect(callback, []);
  },
}));

jest.mock("../src/mobile/presentation/app-provider.js", () => ({
  useApp: () => ({
    busy: false,
    createSimpleGoal: mockCreateSimpleGoal,
    createAdvancedGoal: mockCreateAdvancedGoal,
    registerMovement: mockRegisterMovement,
    reviseMovement: mockReviseMovement,
    getGoal: mockGetGoal,
    changeGoalStatus: jest.fn(async () => mockGoalDetail),
    closeActualPeriod: jest.fn(async () => mockGoalDetail),
    reviseAdvancedContribution: mockReviseAdvancedContribution,
    convertAdvancedGoalToSimple: mockConvertAdvancedGoalToSimple,
    voidMovement: mockVoidMovement,
  }),
}));

async function completeBasicGoal() {
  await fireEvent.changeText(screen.getByLabelText("Nombre de la meta"), "Emergencias");
  await fireEvent.changeText(
    screen.getByLabelText("Monto por periodo en pesos colombianos"),
    "200000",
  );
  await fireEvent.changeText(screen.getByLabelText("Cantidad de meses"), "6");
}

describe("formulario móvil de metas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMovementId = undefined;
  });

  it("crea primero una meta simple sin exponer campos avanzados", async () => {
    await render(<NewGoalScreen />);
    await completeBasicGoal();

    expect(screen.queryByLabelText("Saldo inicial en pesos colombianos")).toBeNull();
    await fireEvent.press(screen.getByText("Guardar esta ruta"));

    await waitFor(() => expect(mockCreateSimpleGoal).toHaveBeenCalledTimes(1));
    expect(mockCreateAdvancedGoal).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("activa la ruta E.A. y conserva los campos básicos", async () => {
    await render(<NewGoalScreen />);
    await completeBasicGoal();
    await fireEvent(screen.getByLabelText("Usar proyección avanzada"), "valueChange", true);
    await fireEvent.press(screen.getByLabelText("Tengo una tasa E.A."));
    await fireEvent.changeText(
      screen.getByLabelText("Valor original de la tasa en porcentaje"),
      "10",
    );
    await fireEvent.press(screen.getByText("Guardar esta ruta"));

    await waitFor(() => expect(mockCreateAdvancedGoal).toHaveBeenCalledTimes(1));
    expect(mockCreateAdvancedGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Emergencias",
        periodicAmount: "200000",
        numberOfPeriods: 6,
        yieldChoice: "EA",
        rateValue: "10",
      }),
    );
  });

  it("permite otra tasa soportada y bloquea No estoy seguro", async () => {
    const { unmount } = await render(<NewGoalScreen />);
    await completeBasicGoal();
    await fireEvent(screen.getByLabelText("Usar proyección avanzada"), "valueChange", true);
    await fireEvent.press(
      screen.getByLabelText("Tengo otro tipo de tasa"),
    );
    await fireEvent.press(screen.getByLabelText("Tipo de tasa N.M.V."));
    await fireEvent.changeText(
      screen.getByLabelText("Valor original de la tasa en porcentaje"),
      "12",
    );
    await fireEvent.press(screen.getByText("Guardar esta ruta"));
    await waitFor(() => expect(mockCreateAdvancedGoal).toHaveBeenCalledTimes(1));
    expect(mockCreateAdvancedGoal).toHaveBeenCalledWith(
      expect.objectContaining({ yieldChoice: "OTHER", otherRateType: "NMV" }),
    );

    await unmount();
    jest.clearAllMocks();
    await render(<NewGoalScreen />);
    await completeBasicGoal();
    await fireEvent(screen.getByLabelText("Usar proyección avanzada"), "valueChange", true);
    await fireEvent.press(screen.getByLabelText("No estoy seguro"));
    expect(screen.getByText("Busca estos datos antes de continuar")).toBeTruthy();
    await fireEvent.press(screen.getByText("Guardar esta ruta"));
    expect(mockCreateAdvancedGoal).not.toHaveBeenCalled();
    expect(
      screen.getByText(/No se usará una tasa inventada/),
    ).toBeTruthy();
  });
});

describe("registro móvil de realidad", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMovementId = undefined;
  });

  it("exige explicación para un ajuste y envía el movimiento confirmado", async () => {
    await render(<RegisterMovementScreen />);
    await fireEvent.press(screen.getByLabelText("Ajuste"));
    await fireEvent.changeText(screen.getByLabelText("Monto del movimiento"), "-5000");
    await fireEvent.changeText(
      screen.getByLabelText("Fecha efectiva, formato año mes día"),
      "2026-08-03",
    );
    await fireEvent.press(
      screen.getByText("Confirmar movimiento"),
    );
    expect(mockRegisterMovement).not.toHaveBeenCalled();
    expect(screen.getByText("Explica el motivo del ajuste.")).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText("Explicación obligatoria del ajuste"),
      "Conciliación manual",
    );
    await fireEvent.press(
      screen.getByText("Confirmar movimiento"),
    );
    await waitFor(() => expect(mockRegisterMovement).toHaveBeenCalledTimes(1));
    expect(mockRegisterMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ADJUSTMENT",
        amount: "-5000",
        effectiveDate: "2026-08-03",
        note: "Conciliación manual",
      }),
    );
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("precarga y corrige un movimiento sólo después de exigir un motivo", async () => {
    mockMovementId = mockGoalDetail.movements[0]?.id;
    await render(<RegisterMovementScreen />);
    await screen.findByText("Corrige sin borrar el pasado.");
    await waitFor(() =>
      expect(screen.getByLabelText("Monto del movimiento").props.value).toBe(
        "200000",
      ),
    );

    await fireEvent.changeText(
      screen.getByLabelText("Monto del movimiento"),
      "210000",
    );
    await fireEvent.press(screen.getByText("Guardar corrección"));
    expect(mockReviseMovement).not.toHaveBeenCalled();
    expect(
      screen.getByText("Explica el motivo de la corrección."),
    ).toBeTruthy();

    await fireEvent.changeText(
      screen.getByLabelText("Motivo de la corrección"),
      "Monto verificado",
    );
    await fireEvent.press(screen.getByText("Guardar corrección"));
    await waitFor(() =>
      expect(mockReviseMovement).toHaveBeenCalledWith({
        goalId: mockGoalDetail.id,
        movementId: mockGoalDetail.movements[0]?.id,
        type: "CONTRIBUTION",
        amount: "210000",
        effectiveDate: "2026-02-01",
        reason: "Monto verificado",
      }),
    );
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe("detalle móvil auditable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMovementId = undefined;
  });

  it("crea una revisión con aporte, vigencia y motivo explícitos", async () => {
    await render(<GoalDetailScreen />);
    await screen.findByText("Revisar un supuesto");
    await fireEvent.changeText(
      screen.getByLabelText("Nuevo aporte por periodo"),
      "250000",
    );
    await fireEvent.changeText(
      screen.getByLabelText("Motivo de la revisión"),
      "Cambio de capacidad",
    );
    await fireEvent.press(screen.getByText("Guardar nueva revisión"));
    await waitFor(() =>
      expect(mockReviseAdvancedContribution).toHaveBeenCalledWith({
        goalId: mockGoalDetail.id,
        periodicAmount: "250000",
        effectiveFrom: "2026-03-01",
        reason: "Cambio de capacidad",
      }),
    );
  });

  it("exige un motivo escrito antes de anular un movimiento", async () => {
    await render(<GoalDetailScreen />);
    await screen.findByText("Historial");
    await fireEvent.press(screen.getByText("Anular con trazabilidad"));
    expect(screen.getByLabelText("Motivo de la anulación")).toBeTruthy();
    expect(mockVoidMovement).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByLabelText("Motivo de la anulación"),
      "Registro duplicado",
    );
    await fireEvent.press(screen.getByText("Confirmar anulación"));
    await waitFor(() =>
      expect(mockVoidMovement).toHaveBeenCalledWith(
        mockGoalDetail.id,
        mockGoalDetail.movements[0]?.id,
        "Registro duplicado",
      ),
    );
  });

  it("abre la corrección desde el movimiento activo", async () => {
    await render(<GoalDetailScreen />);
    await screen.findByText("Historial");
    await fireEvent.press(screen.getByText("Corregir con trazabilidad"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/goal/[id]/register",
      params: {
        id: mockGoalDetail.id,
        movementId: mockGoalDetail.movements[0]?.id,
      },
    });
  });
});
