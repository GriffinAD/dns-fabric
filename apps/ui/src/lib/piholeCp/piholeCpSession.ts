import { PiholeCpDashboardGateway } from "./PiholeCpDashboardGateway";
import { PiholeCpGateway } from "./PiholeCpGateway";

export type PiholeCpSession = {
  baseUrl: string;
  controlPlane: PiholeCpGateway;
  dashboardGateway: PiholeCpDashboardGateway;
};

export function createPiholeCpSession(baseUrl: string): PiholeCpSession {
  return {
    baseUrl,
    controlPlane: new PiholeCpGateway(baseUrl),
    dashboardGateway: new PiholeCpDashboardGateway(baseUrl),
  };
}
