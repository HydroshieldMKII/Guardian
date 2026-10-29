import { Injectable, Logger } from '@nestjs/common';

export interface NewDeviceDetectedEvent {
  userId: string;
  username: string;
  deviceName: string;
  deviceIdentifier: string;
  ipAddress: string;
  platform: string;
  sessionKey?: string;
}

export interface DeviceLocationChangedEvent {
  userId: string;
  username: string | null;
  deviceName: string | null;
  deviceIdentifier: string;
  oldIpAddress: string | null;
  newIpAddress: string | null;
  sessionKey?: string | null;
}

type Listener<T> = (event: T) => void;

@Injectable()
export class DeviceEventsService {
  private readonly logger = new Logger(DeviceEventsService.name);
  private readonly newDeviceListeners: Listener<NewDeviceDetectedEvent>[] = [];
  private readonly locationChangeListeners: Listener<DeviceLocationChangedEvent>[] =
    [];

  onNewDeviceDetected(listener: Listener<NewDeviceDetectedEvent>): void {
    this.newDeviceListeners.push(listener);
  }

  onDeviceLocationChanged(
    listener: Listener<DeviceLocationChangedEvent>,
  ): void {
    this.locationChangeListeners.push(listener);
  }

  emitNewDevice(event: NewDeviceDetectedEvent): void {
    this.notify(this.newDeviceListeners, event, 'new device');
  }

  emitLocationChange(event: DeviceLocationChangedEvent): void {
    this.notify(this.locationChangeListeners, event, 'location change');
  }

  private notify<T>(listeners: Listener<T>[], event: T, label: string): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.error(`Error in ${label} callback`, error);
      }
    }
  }
}
