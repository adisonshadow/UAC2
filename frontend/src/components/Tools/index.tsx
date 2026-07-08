export const Tool = {
    time: {
        isWeekend: function(date: Date) {
            const day = date.getDay();
            return day === 0 || day === 6;
        },
        formatDate: function(date: Date) {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${month}/${day}`;
        },  
        DateToUnixToNumber: function(date: Date) {
            return Math.floor(date.getTime() / 1000);
        },  
        UnixStampToDate: function(unixStamp: number) {
            return new Date(unixStamp * 1000);
        },
        
        genNextDates: function(dateArgs?: Date, amountArgs?: number) {
            let data = dateArgs || new Date();
            let amount = amountArgs || 1;
            return new Date(+data + 24 * 60 * 60 * 1000 * amount);
        }

    },
    getRandomNumber: function (min: number, max: number) {
        return Math.floor(Math.random() * (max - min) + min);
    },
    getRandomChar: function (length: number, ifUpcaser: boolean) {
        let str = "";
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
        }
        return ifUpcaser? str.toUpperCase() : str;
    },

    //  函数：以今天为基准，随机获取向前或向后一定范围内的一点
    getRandomDate: function (min: number, max: number) {
        const now = new Date();
        const random = Math.floor(Math.random() * (max - min) + min);
        return Tool.time.genNextDates(now, random);
    },

    // 定义一组中国人名字的数组，随机从数组中抽取一个名字
    getRandomChineseName: function () {
        const nameStrs = "马灵 王欣 许世豪 韩奇良 庞梦琳 孔维佳 马天宇 石宸宇 赵亮 包瑞祺 骆润 严艺嘉 吴漩 江嘉城 张俊 李超 徐溪然 陈廷轩 翁腾浩 汪盛健 谭华成 柯易 钟耀辉"
        const names = nameStrs.split(" ");
        return names[Math.floor(Math.random() * names.length)];
    },

    //
    // table: {
    //     mergeRows :(rows, key) => {
    //         rows[0].rowSpan = 1;
    //         let idx = 0;
    //         return rows.slice(1).reduce(
    //           (mergedRows, item, index) => {
    //             if (item[key] === mergedRows[idx][key]) {
    //               mergedRows[idx].rowSpan++;
    //               item.colSpan = 0;
    //             } else {
    //               item.rowSpan = 1;
    //               idx = index + 1;
    //             }
    //             return [...mergedRows, item];
    //           },
    //           [rows[0]]
    //         );
    //     }
    // },
      
} 