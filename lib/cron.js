'use strict';

const Cli = require('structured-cli');

module.exports = {
    parseSchedule,
    parseTimezone,
};

const intervals = {
    minutes: {
        abbrev: ['m', 'min', 'mins', 'minute', 'minutes'],
        values: [1, 2, 3, 4, 5, 6, 10, 15, 20, 30, 60],
        encode(frequencyValue) {
            const now = new Date();
            const cron = ['*', '*', '*', '*', '*'];
            const curr = now.getMinutes();
            const mod = curr % frequencyValue;

            cron[0] =
                frequencyValue === 60
                    ? curr
                    : mod > 0
                      ? curr % frequencyValue + '-' + 59 + '/' + frequencyValue
                      : '*/' + frequencyValue;

            return cron.join(' ');
        },
    },
    hours: {
        abbrev: ['h', 'hour', 'hours'],
        values: [1, 2, 3, 4, 6, 8, 12, 24],
        encode(frequencyValue) {
            const now = new Date();
            const cron = [now.getMinutes(), '*', '*', '*', '*'];
            const curr = now.getHours();
            const mod = curr % frequencyValue;

            cron[1] =
                frequencyValue === 24
                    ? curr
                    : mod > 0
                      ? curr % frequencyValue + '-' + 23 + '/' + frequencyValue
                      : '*/' + frequencyValue;

            return cron.join(' ');
        },
    },
    days: {
        abbrev: ['d', 'day', 'days'],
        values: [1],
        encode() {
            return intervals.hours.encode(24);
        },
    },
};

function parseSchedule(schedule) {
    if (schedule.split(' ').length !== 5) {
        const minutesRx = new RegExp(
            '^\\s*([0-9]{1,2})\\s*(' +
                intervals.minutes.abbrev.join('|') +
                ')\\s*$',
            'i'
        );
        const hoursRx = new RegExp(
            '^\\s*([0-9]{1,2})\\s*(' +
                intervals.hours.abbrev.join('|') +
                ')\\s*$',
            'i'
        );
        const daysRx = new RegExp(
            '^\\s*([0-9]{1,2})\\s*(' +
                intervals.days.abbrev.join('|') +
                ')\\s*$',
            'i'
        );
        let frequencyValue;
        let type;
        let matches;

        if ((matches = schedule.match(minutesRx))) {
            type = intervals.minutes;
            frequencyValue = parseInt(matches[1], 10);
        } else if ((matches = schedule.match(hoursRx))) {
            type = intervals.hours;
            frequencyValue = parseInt(matches[1], 10);
        } else if ((matches = schedule.match(daysRx))) {
            type = intervals.days;
            frequencyValue = parseInt(matches[1], 10);
        } else {
            throw new Cli.error.invalid(
                'The schedule `' + schedule + '` is not valid.'
            );
        }

        if (type.values.indexOf(frequencyValue) === -1) {
            throw new Cli.error.invalid(
                'For intervals in ' +
                    type.abbrev[type.abbrev.length - 1] +
                    ', the following intervals are supported: ' +
                    type.values.join(', ')
            );
        }

        schedule = type.encode(frequencyValue);
    }

    return schedule;
}

function parseTimezone(tz) {
    const Moment = require('moment-timezone');

    if (!Moment.tz.zone(tz)) {
        throw new Cli.error.invalid(
            `The timezone "${tz}" is not recognized. Please specify a valid IANA timezone name (see: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).`
        );
    }

    return tz;
}
