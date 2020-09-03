import { observable } from 'mobx'
import { runQuery } from '../database/dynamodb'
import moment from 'moment'
import { TABLE_NAME, EVENTS_UPDATE_INTERVAL, DATE_FORMAT } from '../constants'
import { isToday } from '../utils'

let loading = false
let interval = null

export default observable({
    events: [],
    lastTs: null,
    initialized: false,
    date: new Date(),

    startUpdate() {
        if (interval) clearInterval(interval)
        interval = setInterval(
            () => { 
                if(isToday(this.date)) this.loadStratingFromTS(this.lastTs)
            },
            EVENTS_UPDATE_INTERVAL
        )
    },

    stopUpdate() {
        if (interval) clearInterval(interval)
    },

    loadStratingFromTS(ts) {
        if (loading) return
        loading = true

        const keyValue = moment(this.date).utc().format(DATE_FORMAT)

        const query = {
            TableName: TABLE_NAME,
            KeyConditions: {
                date: {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [keyValue]
                }
            },
            ScanIndexForward: false
        }

        if (ts) {
            query.KeyConditions['time'] = {
                ComparisonOperator: 'GT',
                AttributeValueList: [ts]
            }
        }

        runQuery(query).then(({ items }) => {
            loading = false
            this.initialized = true
            this.events = items
                .map((item) => {
                    item.filter = [
                        item.type,
                        item.username, 
                        item.firstname, 
                        item.lastname,
                        item.bot
                    ].join(' ')
                    return item
                })
                .concat(this.events)
            this.lastTs = Date.now()
        })
    },

    setDate(date) {
        this.date = date
        this.reload()
    },

    reload() {
        this.initialized = false
        this.events = []
        this.loadStratingFromTS(null)
    }
})