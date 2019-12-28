const _ = require("underscore");
const Api = require("./api");

const ACTIVE_DELAY = 1000 * 2;
const IDLE_DELAY = 1000 * 10;

module.exports = class ChamberlainAccessory {
    constructor(log, config, homebridge) {
        this.log = log;

        this.api = new Api({
            MyQDeviceId: config.deviceId,
            password: config.password,
            username: config.username
        });

        const {
            Service,
            Characteristic
        } = homebridge.hap;

        const {
            CurrentDoorState,
            TargetDoorState
        } = Characteristic;

        this.apiToHap = {
            "open": CurrentDoorState.OPEN,
            "closed": CurrentDoorState.CLOSED,
        };

        this.hapToApi = {
            [TargetDoorState.OPEN]: "open",
            [TargetDoorState.CLOSED]: "close"
        };

        this.hapToEnglish = {
            [CurrentDoorState.OPEN]: "open",
            [CurrentDoorState.CLOSED]: "closed",
            [CurrentDoorState.OPENING]: "opening",
            [CurrentDoorState.CLOSING]: "closing"
        };

        this.currentToTarget = {
            [CurrentDoorState.OPEN]: TargetDoorState.OPEN,
            [CurrentDoorState.CLOSED]: TargetDoorState.CLOSED,
            [CurrentDoorState.OPENING]: TargetDoorState.OPEN,
            [CurrentDoorState.CLOSING]: TargetDoorState.CLOSED
        };

        const service = this.service = new Service.GarageDoorOpener(config.name);

        this.states = {
            doorstate:
                service.getCharacteristic(Characteristic.CurrentDoorState)
                       .on("get", this.getCurrentDoorState.bind(this))
                       .on("change", this.logChange.bind(this, "doorstate")),
            desireddoorstate:
                service.getCharacteristic(Characteristic.TargetDoorState)
                       .on("set", this.setTargetDoorState.bind(this))
                       .on("change", this.logChange.bind(this, "desireddoorstate"))
        };

        this.states.doorstate.value = CurrentDoorState.CLOSED;
        this.states.desireddoorstate.value = TargetDoorState.CLOSED;

        (this.poll = this.poll.bind(this))();
    }

    poll() {
        clearTimeout(this.pollTimeoutId);

        const {
            doorstate,
            desireddoorstate
        } = this.states;

        return new Promise((resolve, reject) => this.states.doorstate.getValue(er => er ? reject(er) : resolve())).then(() => this.states.doorstate.value !== this.states.desireddoorstate.value ? ACTIVE_DELAY : IDLE_DELAY).catch(_.noop).then((delay = IDLE_DELAY) => {
            clearTimeout(this.pollTimeoutId);

            this.pollTimeoutId = setTimeout(this.poll, delay);
        });
    }

    logChange(name, state) {
        const from = this.hapToEnglish[state.oldValue];
        const to = this.hapToEnglish[state.newValue];

        this.log.info(`${name} changed from ${from} to ${to}`);

        if (name === "doorstate") {
            this.reactiveSetTargetDoorState = true;
            this.states.desireddoorstate.setValue(this.currentToTarget[state.newValue]);

            delete this.reactiveSetTargetDoorState;
        }
    }

    getCurrentDoorState(cb) {
        return this.api.getDeviceAttribute({
            name: "door_state"
        }).then((value) => {
            cb(null, this.apiToHap[value])
        }).catch((er) => {
            this.log.error(er);

            cb(er);
        });
    }

    setTargetDoorState(value, cb) {
        if (this.reactiveSetTargetDoorState) {
            return cb();
        }

        const action_type = this.hapToApi[value];

        this.targetDoorState = value;

        return this.api.actOnDevice({
            action_type
        }).then(() => {
            this.poll();
            this.targetDoorState = null;

            cb();
        }).catch((er) => {
            this.log.error(er);

            cb(er);
        });
    }

    getServices() {
        return [this.service];
    }
};
