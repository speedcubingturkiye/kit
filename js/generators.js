
// Paper sizes (in mm)
// Standard A series paper sizes
const A4L_WIDTH = 297
const A4L_HEIGHT = 210
const A4P_WIDTH = 210
const A4P_HEIGHT = 297
const A5L_WIDTH = 210
const A5L_HEIGHT = 148.5
const A5P_WIDTH = 148.5
const A5P_HEIGHT = 210
const A6L_WIDTH = 148.5
const A6L_HEIGHT = 105
const A6P_WIDTH = 105
const A6P_HEIGHT = 148.5
const A7L_WIDTH = 105
const A7L_HEIGHT = 74.25
const A7P_WIDTH = 74.25
const A7P_HEIGHT = 105

// 8.5x11 inch paper for American Letter Size
const LETTERL_WIDTH = 279.4
const LETTERL_HEIGHT = 215.9

// 4x6 inch paper for American Memo Size
const FOURBYSIXL_WIDTH = 152.4
const FOURBYSIXL_HEIGHT = 101.6

// Globals
var globalDoc
var persons

// Convert mm to PDF units (72ths of an inch)
function mmToPdf(mm) { return (mm * 72.0 / 25.4) }

// Get all the information we need to display for a person
// This includes building a schedule to display
function generatePersonInformation(index) {
    // Information we want to gather
    let isBlank = index >= persons.length
    let name = ""
    let wcaid = null
    let compid = "-"
    let countryCode = ""
    let role = ""
    let personalSchedule = {}
    let sortedSchedule = []

    if (!isBlank) {
        // Get information from wcif
        name = persons[index].name
        wcaid = persons[index].wcaId
        compid = persons[index].registrantId
        countryCode = persons[index].countryIso2.toLowerCase()

        if (persons[index].roles.find((r) => { return r == "delegate" })) {
            role = "delegate"
        } else if (persons[index].roles.find((r) => { return r == "trainee-delegate" })) {
            role = "trainee-delegate"
        } else if (persons[index].roles.find((r) => { return r == "organizer" })) {
            role = "organizer"
        } else if (!persons[index].registration.isCompeting) {
            role = "staff"
        }

        // If a schedule table exists, create a personal schedule for each day
        // This object holds all assignment information per event, combining staffing and competing 
        for (let a = 0; a < persons[index].assignments.length; a++) {
            // Check for activity information
            let assignment = persons[index].assignments[a]
            let activity = activities[assignment.activityId]
            if (activities[assignment.activityId] == undefined) {
                warning = `Missing activity: ${assignment.activityId}`
                continue
            }

            let startTime = moment(activity.roundStartTime).tz(activity.timezone);
            let endTime = moment(activity.roundEndTime).tz(activity.timezone)
            let day = startTime.day()

            // Create daily information if it doesn't exist
            if (personalSchedule[day] == undefined) {
                personalSchedule[day] = {
                    day: day,
                    sortTime: startTime.unix(),
                    assignments: {},
                    sortedAssignments: [],
                }
            }

            let codes = activity.activityCode.split('-')
            let event = codes[0]
            let group = codes[2]
            if (group == undefined) {
                group = "-1"
            }

            // Create assignment for activity if it doesn't exist
            if (personalSchedule[day].assignments[activity.parentActivityCode] == undefined) {
                let eventText = EVENT_MAP[event]
                if (eventText == undefined) {
                    eventText = "Other"
                }
                personalSchedule[day].assignments[activity.parentActivityCode] = {
                    timeText: `${startTime.format("HH[:]mm")} - ${endTime.format("HH[:]mm")}`,
                    sortTime: startTime.unix(),
                    eventCode: event,
                    eventText: eventText,
                    stageText: activity.roomName,
                    competing: -1,
                    stationNumber: null,
                    judging: [],
                    running: [],
                    scrambling: [],
                }
            }

            // Add information to assignment
            if (assignment.assignmentCode == "competitor") {
                personalSchedule[day].assignments[activity.parentActivityCode].competing = group.substr(1)
                personalSchedule[day].assignments[activity.parentActivityCode].stationNumber = assignment.stationNumber
                personalSchedule[day].assignments[activity.parentActivityCode].stageColor = activity.roomColor
            } else if (assignment.assignmentCode == "staff-judge") {
                personalSchedule[day].assignments[activity.parentActivityCode].judging.push(group.substr(1))
            } else if (assignment.assignmentCode == "staff-runner") {
                personalSchedule[day].assignments[activity.parentActivityCode].running.push(group.substr(1))
            } else if (assignment.assignmentCode == "staff-scrambler") {
                personalSchedule[day].assignments[activity.parentActivityCode].scrambling.push(group.substr(1))
            } else {
                warning = `Unhandled assignment code: ${assignment.assignmentCode}`
            }
        }

        // Sort daily schedules by start time
        for (let value of Object.values(personalSchedule)) {
            sortedSchedule.push(value)
        }

        sortedSchedule.sort((a, b) => {
            if (a.sortTime < b.sortTime) {
                return -1
            }
            if (a.sortTime > b.sortTime) {
                return 1
            }
            return 0
        })

        // Sort assignments within day by time they start
        for (let i = 0; i < sortedSchedule.length; i++) {
            for (let value of Object.values(sortedSchedule[i].assignments)) {
                sortedSchedule[i].sortedAssignments.push(value)
            }

            sortedSchedule[i].sortedAssignments.sort((a, b) => {
                if (a.sortTime < b.sortTime) {
                    return -1
                }
                if (a.sortTime > b.sortTime) {
                    return 1
                }
                return a.eventCode.localeCompare(b.eventCode)
            })
        }
    }

    return {
        blank: isBlank,
        get name() {return name || settings.placeholderName},
        wcaid: wcaid,
        compid: compid,
        countryCode: countryCode,
        personalSchedule: personalSchedule,
        sortedSchedule: sortedSchedule,
        role: role,
    }
}

// Draw a name with support for non-latin unicode characters in brackets
// e.g text = "Latin Name (LocalName)"
// x,y,w,h specifies box for text to be located in
// align specifies if text should be left aligned or centred within box
function drawName(doc, text, align, x, y, w, h, latinFont = "NotoSans-Bold") {
    // Determine names
    const [, latinName, localName] = text.match(/(.*)\s*[(（](.+)[)）]/) || [null, text, null]

    let fontSize = h * 2.2
    doc.saveGraphicsState()

    if (localName && settings.includeLocalName) {
        // Need to handle special local name
        let localFont = determineFont(localName)
        console.log(`Local name ${localName} with font ${localFont}`)

        // Find lengths of all text components
        doc.setFont(latinFont)
        doc.setFontSize(fontSize)

        let startString = latinName == "" ? "(" : `${latinName} (`

        let length1 = doc.getTextWidth(startString)
        let length3 = doc.getTextWidth(`)`)

        doc.setFont(localFont)
        let length2 = doc.getTextWidth(`${localName}`)

        // Padding required if text will be centred within box
        let xPadding = Math.max(0, (w - (length1 + length2 + length3)) / 2)
        if (align == "left") {
            xPadding = 0
        }

        // Horizontal scaling required to fit within box
        let horizontalScale = Math.min(1, w / (length1 + length2 + length3))

        // Draw text components
        doc.setFont(latinFont)
        doc.text(startString, x + xPadding, y, {
            align: "left",
            horizontalScale: horizontalScale,
        })
        doc.text(`)`, x + xPadding + ((length1 + length2) * horizontalScale), y, {
            align: "left",
            horizontalScale: horizontalScale,
        })

        doc.setFont(localFont)
        doc.text(`${localName}`, x + xPadding + (length1 * horizontalScale), y, {
            align: "left",
            horizontalScale: horizontalScale,
        })

    } else {
        // Just latin text to be drawn
        doc.setFont(latinFont)
        doc.setFontSize(fontSize)
        let textWidth = doc.getTextWidth(latinName)
        let horizontalScale = Math.min(1, w / textWidth)
        if (horizontalScale == 1 && align == "center") {
            doc.text(latinName, (w / 2) + x, y, {
                align: "center"
            })
        } else {
            doc.text(latinName, x, y, {
                align: "left",
                horizontalScale: horizontalScale,
            })
        }
    }
    doc.restoreGraphicsState()
}

// Split a name so it fits evenly across two lines
// h is height of one line
function splitNameOntoTwoLines(doc, text, h, splitThreshold) {
    let fontSize = h * 2.2
    doc.saveGraphicsState()

    doc.setFont("NotoSans-Bold")
    doc.setFontSize(fontSize)
    let spaceLength = doc.getTextWidth(' ')

    // Find length of all parts of name
    let textParts
    let bracketIndex = text.indexOf("(")
    if (bracketIndex != -1) {
        let bracketPart = text.slice(bracketIndex)
        textParts = text.substr(0, bracketIndex - 1).split(" ")
        textParts.push(bracketPart)
    } else {
        textParts = text.split(" ")
    }

    if (textParts.length < 1) {
        doc.restoreGraphicsState()
        return ["", "", 0, 0]
    } else if (textParts.length < 2) {
        let textLength = doc.getTextWidth(textParts[0])
        doc.restoreGraphicsState()
        return ["", text, 0, textLength]
    }

    let textLengths = []
    let hasLocalName = false
    for (let i = 0; i < textParts.length; i++) {
        const [, latinName, localName] = textParts[i].match(/(.*)\s*[(（](.+)[)）]/) || [null, textParts[i], null]

        if (localName && settings.includeLocalName) {
            hasLocalName = true
            let localFont = determineFont(localName)

            // Include local names if we want them
            doc.setFont("NotoSans-Bold")
            doc.setFontSize(fontSize)
            let length1 = doc.getTextWidth(`(`)
            let length3 = doc.getTextWidth(`)`)
            doc.setFont(localFont)
            let length2 = doc.getTextWidth(`${localName}`)

            textLengths.push(length1 + length2 + length3)
        } else if (localName) {
            // Don't include local names if we didn't want to include them
            textParts.splice(i, 1)
            i--
        } else {
            // Include normal names
            doc.setFont("NotoSans-Bold")
            doc.setFontSize(fontSize)
            textLengths.push(doc.getTextWidth(latinName))
        }
    }

    doc.restoreGraphicsState()

    // Determine best way to split
    let totalLength = 0
    for (let i = 0; i < textParts.length; i++) {
        totalLength += textLengths[i]
    }
    totalLength += (textParts.length - 1) * spaceLength
    let target = (totalLength - spaceLength) / 2
    if (splitThreshold && totalLength <= splitThreshold) {
        return ["", textParts.join(" "), 0, totalLength]
    }

    if (hasLocalName) {
        // If they have a local name, prefer to have it on its own line
        let localNameLength = textLengths.at(-1)
        let latinNameLength = totalLength - spaceLength - localNameLength
        if (latinNameLength <= splitThreshold && localNameLength <= splitThreshold) {
            return [textParts.slice(0, -1).join(" "), textParts.at(-1), latinNameLength, localNameLength]
        }
    }

    let firstLine = ""
    let secondLine = textParts.at(-1)
    let secondLineLength = textLengths.at(-1)
    for (let i = textParts.length - 2; i >= 0; i--) {
        let nextLength = secondLineLength + spaceLength + textLengths[i]
        if (Math.abs(secondLineLength - target) <= Math.abs(nextLength - target)) {
            // Add rest to first length
            firstLine = textParts[i]
            for (let j = i - 1; j >= 0; j--) {
                firstLine = textParts[j] + " " + firstLine
            }
            break
        } else {
            // Add to second length
            secondLine = textParts[i] + " " + secondLine
            secondLineLength = nextLength
        }
    }

    return [firstLine, secondLine, totalLength - spaceLength - secondLineLength, secondLineLength]
}

// Draw a box with text in it
// x,y,w,h specifies box
// align specifies if text should be left aligned or centred within box
// fillColor is an optional fill color in box
// icon is an optional WCA event code that will be drawn in left of box
function drawTextBox(doc, text, align, x, y, w, h, fillColor = [255, 255, 255], icon = "") {
    doc.saveGraphicsState()

    // Draw box
    doc.setLineWidth(0.1)
    doc.setDrawColor(128, 128, 128)
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2])
    doc.rect(x, y, w, h, "FD")

    // Determine spacing for text
    let fontSize = h * 2.2
    let xPadding = h * 0.1
    let yPadding = h * 0.78
    let xPaddingIcon = xPadding
    let yPaddingIcon = h * 0.85
    if (icon) {
        xPadding += h * 1
    }

    // Draw the text
    doc.setFontSize(fontSize)
    let textWidth = doc.getTextWidth(text) + (xPadding * 2)
    let horizontalScale = Math.min(1, w / textWidth)
    if (align == "left") {
        doc.text(text, x + xPadding, y + yPadding, {
            align: "left",
            horizontalScale: horizontalScale,
        })
    } else if (align == "center") {
        doc.text(text, x + (w / 2), y + yPadding, {
            align: "center",
            horizontalScale: horizontalScale,
        })
    }

    // Draw the icon
    if (EVENT_CHARACTERS[icon] != undefined) {
        doc.setFont("cubing-icons")
        doc.text(EVENT_CHARACTERS[icon], x + xPaddingIcon, y + yPaddingIcon, {
            align: "left",
            horizontalScale: 1,
        })
    }

    doc.restoreGraphicsState()
}

// Draw some text with alignment and a maximum width allowed
// x,y,w,h specifies box
function drawText(doc, text, align, x, y, w, h) {
    // Just latin text to be drawn
    let fontSize = h * 2.2
    doc.setFontSize(fontSize)

    let textWidth = doc.getTextWidth(text)
    let horizontalScale = Math.min(1, w / textWidth)
    if (horizontalScale == 1 && align == "center") {
        doc.text(text, (w / 2) + x, y, {
            align: "center"
        })
    } else {
        doc.text(text, x, y, {
            align: "left",
            horizontalScale: horizontalScale,
        })
    }
}

// Use the user supplied program to get a color based on a rows details
function getRowColor(row, event, group, station, room) {
    let color = "#FFFFFF"
    eval(settings.customScheduleColorsCode)
    return color
}

// Take an image element and tint it based on color
// Returns new element
function createTintedImage(img, color) {
    let w = img.width
    let h = img.height

    let canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h

    let ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)
    let pixels = ctx.getImageData(0, 0, w, h).data

    let to = ctx.getImageData(0, 0, w, h)
    let toData = to.data

    for (let i = 0, len = pixels.length; i < len; i += 4) {
        toData[i] = pixels[i] * (color[0] / 255.0)
        toData[i + 1] = pixels[i + 1] * (color[1] / 255.0)
        toData[i + 2] = pixels[i + 2] * (color[2] / 255.0)
        toData[i + 3] = pixels[i + 3]
    }

    ctx.putImageData(to, 0, 0)

    let imgComp = new Image()
    imgComp.src = canvas.toDataURL()

    return imgComp
}

// Draw the individual schedule
// Returns the final height of the schedule
function drawSchedule(doc, x, y, w, info, hscale = 1.0) {

    // Place schedule
    const TIME_RATIO = 0.21
    const EVENT_RATIO = 0.31
    const GROUP_RATIO = 0.07
    const STAGE_RATIO = 0.18
    const STATION_RATIO = 0.07
    const STAFF_RATIO = 0.16

    let scale = EVENT_RATIO + GROUP_RATIO

    if (settings.includeTimes) {
        scale += TIME_RATIO
    }
    if (settings.includeStations) {
        scale += STATION_RATIO
    }
    if (settings.includeStaffing) {
        scale += STAFF_RATIO
    }
    if (settings.includeStages) {
        scale += STAGE_RATIO
    }

    let timeWidth = (w * TIME_RATIO) / scale
    let eventWidth = (w * EVENT_RATIO) / scale
    let groupWidth = (w * GROUP_RATIO) / scale
    let stationWidth = (w * STATION_RATIO) / scale
    let staffWidth = (w * STAFF_RATIO) / scale
    let stageWidth = (w * STAGE_RATIO) / scale

    let row = y
    let column = x

    let height = 2.5 * hscale

    if (!info.blank) {
        // Header
        if (settings.includeTimes) {
            drawTextBox(doc, "Time", "left", column, row, timeWidth, height)
            column += timeWidth
        }
        drawTextBox(doc, "Event", "left", column, row, eventWidth, height)
        column += eventWidth
        if (settings.includeStages) {
            drawTextBox(doc, "Stage", "left", column, row, stageWidth, height)
            column += stageWidth
        }
        drawTextBox(doc, "Group", "left", column, row, groupWidth, height)
        column += groupWidth
        if (settings.includeStations) {
            drawTextBox(doc, "Station", "left", column, row, stationWidth, height)
            column += stationWidth
        }
        if (settings.includeStaffing) {
            drawTextBox(doc, "Staff Groups", "left", column, row, staffWidth, height)
            column += staffWidth
        }
        row += height
        column = x

        // For each daily schedule
        for (let i = 0; i < info.sortedSchedule.length; i++) {
            // Add day header
            height = 4 * hscale
            drawTextBox(doc, WEEK_DAYS_MAP[info.sortedSchedule[i].day], "center", column, row, w, height)
            row += height

            // For each assignment within the day
            let alternatingColors = 0
            for (let j = 0; j < info.sortedSchedule[i].sortedAssignments.length; j++) {
                let assignment = info.sortedSchedule[i].sortedAssignments[j]

                // If the competitor isn't competing, and we don't show staffing or don't want to show staff only roles in a round
                // Then don't show this assignment   
                if (assignment.competing == -1 && (!settings.includeStaffing || settings.hideStaffOnlyAssignments)) {
                    continue
                }

                // Determine staffing role text
                let roleText = ""
                let roleTypeCount = 0
                roleTypeCount += assignment.judging.length ? 1 : 0;
                roleTypeCount += assignment.running.length ? 1 : 0;
                roleTypeCount += assignment.scrambling.length ? 1 : 0
                let shortRoles = roleTypeCount > 1

                // Sort staffing roles to ensure consistent and predictable rendering order
                assignment.judging.sort((a, b) => a - b)
                assignment.running.sort((a, b) => a - b)
                assignment.scrambling.sort((a, b) => a - b)

                for (let k = 0; k < assignment.judging.length; k++) {
                    if (k == 0) {
                        roleText += shortRoles ? " J:" : " Judge:"
                        roleText += ` ${assignment.judging[k]}`
                    } else {
                        roleText += `, ${assignment.judging[k]}`
                    }
                }
                for (let k = 0; k < assignment.running.length; k++) {
                    if (k == 0) {
                        roleText += shortRoles ? " R:" : " Run:"
                        roleText += ` ${assignment.running[k]}`
                    } else {
                        roleText += `, ${assignment.running[k]}`
                    }
                }
                for (let k = 0; k < assignment.scrambling.length; k++) {
                    if (k == 0) {
                        roleText += shortRoles ? " S:" : " Scram:"
                        roleText += ` ${assignment.scrambling[k]}`
                    } else {
                        roleText += `, ${assignment.scrambling[k]}`
                    }
                }

                roleText = roleText.trimStart()

                let competingGroup = assignment.competing
                if (assignment.competing == -1 && settings.includeStaffing) {
                    competingGroup = "-"
                }

                // Add assignment to schedule
                let stationText = "-"
                if (assignment.competing == -1) {
                    stationText = `-`
                } else if (assignment.stationNumber == null) {
                    stationText = `any`
                } else {
                    stationText = `${assignment.stationNumber}`
                }

                let fillColor = [255, 255, 255]
                if (settings.customScheduleColors) {
                    fillColor = hexToRgb(getRowColor(alternatingColors, assignment.eventCode, assignment.competing, assignment.stationNumber, assignment.stageText))
                } else if (settings.colorFromStage && assignment.stageColor) {
                    fillColor = assignment.stageColor
                } else if (alternatingColors % 2 == 0) {
                    fillColor = [220, 220, 220]
                }
                alternatingColors++

                let height = 3.5 * hscale
                if (settings.includeTimes) {
                    drawTextBox(doc, assignment.timeText, "left", column, row, timeWidth, height, fillColor)
                    column += timeWidth
                }
                drawTextBox(doc, assignment.eventText, "left", column, row, eventWidth, height, fillColor, assignment.eventCode)
                column += eventWidth
                if (settings.includeStages) {
                    drawTextBox(doc, assignment.stageText, "left", column, row, stageWidth, height, fillColor)
                    column += stageWidth
                }
                drawTextBox(doc, `${competingGroup}`, "left", column, row, groupWidth, height, fillColor)
                column += groupWidth
                if (settings.includeStations) {
                    drawTextBox(doc, stationText, "left", column, row, stationWidth, height, fillColor)
                    column += stationWidth
                }
                if (settings.includeStaffing) {
                    drawTextBox(doc, roleText, "left", column, row, staffWidth, height, fillColor)
                    column += staffWidth
                }
                row += height
                column = x
            }
        }
    }

    return row - y
}

// Draw an entire standard portrait badge (name and schedule side) with page dimensions
// tx and ty are offset on page to draw at
function addPortraitNameBadgeWithDimensions(doc, index, badgeWidth, badgeHeight, tx = 0, ty = 0) {
    let info = generatePersonInformation(index)

    let halfWidth = badgeWidth / 2

    // Front name side
    {
        doc.saveGraphicsState()

        // Translate so we are in a landscape A7 space to layout name side
        doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, mmToPdf(tx + halfWidth), mmToPdf(ty)))

        // Add background
        let backgroundRatio = $("#badge-img").height() / $("#badge-img").width()
        doc.addImage($("#badge-img")[0], "PNG", 0, 0, halfWidth, halfWidth * backgroundRatio, "background", "SLOW")

        let nameStart = badgeHeight - 33
        // Place name, starting from bottom and adding extra lines on top for longer names
        if (info.name) {
            let [firstLine, secondLine, firstLineLength, secondLineLength] = splitNameOntoTwoLines(doc, info.name, 10, halfWidth - 6 + 1)
            let scale = 1/Math.max(1, Math.max(firstLineLength, secondLineLength) / (halfWidth - 6))
            drawName(doc, firstLine, "center", 3, nameStart, halfWidth - 6, 10 * scale)
            drawName(doc, secondLine, "center", 3, nameStart + 9, halfWidth - 6, 10 * scale)
        }

        doc.setLineWidth(0.25)
        doc.setDrawColor(0, 0, 0)
        doc.line(5, nameStart + 12, halfWidth - 5, nameStart + 12)

        // Place WCA ID
        doc.setFont("NotoSans-Regular")
        doc.setFontSize(13)

        if (!info.blank) {
            let nameText = info.wcaid
            if (info.role == "delegate" || info.role == "trainee-delegate") {
                doc.setTextColor(196, 0, 0)
                nameText = "DELEGATE"
            } else if (info.role == "organizer") {
                doc.setTextColor(0, 196, 0)
                nameText = "ORGANIZER"
            } else if (info.role == "staff") {
                doc.setTextColor(146, 0, 191)
                nameText = "STAFF"
            } else if (info.wcaid == null) {
                doc.setTextColor(0, 0, 196)
                nameText = "NEWCOMER"
            }
            if (settings.includeCompetitorId && info.compid) {
                nameText += ` - ID ${info.compid}`
            }

            doc.text(nameText, halfWidth / 2, nameStart + 17, {
                align: "center",
            })
        }
        doc.setTextColor(0, 0, 0)

        let logoHeight = Math.min(10, halfWidth / 8)

        // Add logos
        let wcaRatio = $("#wca-img").width() / $("#wca-img").height()
        doc.addImage($("#wca-img")[0], "PNG", 3, badgeHeight - (logoHeight + 3), logoHeight * wcaRatio, logoHeight, "wca", "SLOW")

        if (settings.includeOrgLogo) {
            let orgRatio = $("#org-img").width() / $("#org-img").height()
            doc.addImage($("#org-img")[0], "PNG", halfWidth - (logoHeight * orgRatio) - 3, badgeHeight - (logoHeight + 3), logoHeight * orgRatio, logoHeight, "org", "SLOW")
        }

        // Add country flag
        if (!info.blank) {
            let flagRatio = $(`#${info.countryCode}-flag`).width() / $(`#${info.countryCode}-flag`).height()
            let flagWidth = flagRatio * 5
            doc.addImage($(`#${info.countryCode}-flag`)[0], "PNG", (halfWidth - flagWidth) / 2, badgeHeight - 14, flagWidth, 5, `${info.countryCode}-flag`, "SLOW")

            if (NO_FLAG_BORDERS[info.countryCode.toUpperCase()] == undefined) {
                doc.setLineWidth(0.1)
                doc.setDrawColor(0, 0, 0)
                doc.rect((halfWidth - flagWidth) / 2, badgeHeight - 14, flagWidth, 5)
            }
        }

        doc.restoreGraphicsState()
    }

    // Schedule side
    {
        doc.saveGraphicsState()

        doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, mmToPdf(tx), mmToPdf(ty)))

        if (info.compid !== null && info.compid !== '-') {
            // Place name
            drawName(doc, info.name, "left", 3, 7, halfWidth - 12, 4)

            // Place registration id
            doc.setFont("NotoSans-Regular")
            doc.setFontSize(7)
            doc.text(`${info.compid}`, halfWidth - 6, 6, {
                align: "center",
            })

            // Place schedule
            let height = drawSchedule(doc, 3, 10, halfWidth - 6, info)

            // WCA Live QR code is assumed to be square
            // We don't draw it if the schedule extended down too far
            if (settings.showWcaLiveQrCode && (height + 10) < badgeHeight - 20) {
                doc.addImage($("#qrcode-img")[0], "PNG", halfWidth - 18, badgeHeight - 18, 15, 15, "qrcode", "SLOW")
                doc.setFontSize(8)
                doc.setFont("NotoSans-Regular")
                let wcaLiveLines = doc.splitTextToSize(settings.qrcodeMessage, halfWidth - 25)
                let textHeight = wcaLiveLines.length * 4
                let textStart = badgeHeight - 15 + ((15 - textHeight) / 2)
                for (let i = 0; i < wcaLiveLines.length; i++) {
                    doc.text(wcaLiveLines[i], halfWidth - 20, textStart + (i * 4), {
                        align: "right",
                    })
                }
            }
        }

        doc.setLineWidth(0.25)
        doc.setDrawColor(128, 128, 128);
        doc.line(halfWidth, 0, halfWidth, badgeHeight)

        doc.restoreGraphicsState()
    }

}

// Draw an entire standard portrait badge (name and schedule side) with page dimensions
// tx and ty are offset on page to draw at
// pageType is either "a4", "a6", "letter" or "4x6"
function addLandscapeNameBadgeWithDimensions(doc, index, badgeWidth, badgeHeight, pageType = "", tx = 0, ty = 0) {

    let info = generatePersonInformation(index)
    let halfWidth = badgeWidth / 2

    // Front name side
    {
        doc.saveGraphicsState()

        // Translate so we are in a landscape space to layout name side
        if (pageType == "a4") {
            doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, mmToPdf(tx), mmToPdf(ty)))
            doc.setCurrentTransformationMatrix(new doc.Matrix(0, -1, 1, 0, 0, 0))
            doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, mmToPdf(-A7L_WIDTH * 2), mmToPdf(-61.5)))
        } else if (pageType == "a6") {
            doc.setCurrentTransformationMatrix(new doc.Matrix(0, -1, 1, 0, 121.3, A6L_WIDTH * 2))
        } else if (pageType == "letter") {
            doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, mmToPdf(tx), mmToPdf(ty)))
            doc.setCurrentTransformationMatrix(new doc.Matrix(0, -1, 1, 0, 0, 0))
            doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, mmToPdf(-216), mmToPdf(-76.2)))
        } else if (pageType == "4x6") {
            doc.setCurrentTransformationMatrix(new doc.Matrix(0, -1, 1, 0, 143.7, 288))
        }

        // Add background
        let backgroundRatio = $("#badge-img").height() / $("#badge-img").width()
        doc.addImage($("#badge-img")[0], "PNG", 0, 0, badgeHeight, badgeHeight * backgroundRatio, "background", "SLOW")

        // Place name, starting from bottom and adding extra lines on top for longer names
        let nameStart = halfWidth - 17
        drawName(doc, info.name, "center", 5, nameStart, badgeHeight - 10, 10)

        doc.setLineWidth(0.25)
        doc.setDrawColor(0, 0, 0)
        doc.line(20, nameStart + 2, badgeHeight - 20, nameStart + 2)

        // Place WCA ID
        doc.setFont("NotoSans-Regular")
        doc.setFontSize(13)

        if (!info.blank) {
            let nameText = info.wcaid
            if (info.role == "delegate" || info.role == "trainee-delegate") {
                doc.setTextColor(196, 0, 0)
                nameText = "DELEGATE"
            } else if (info.role == "organizer") {
                doc.setTextColor(0, 160, 0)
                nameText = "ORGANIZER"
            } else if (info.role == "staff") {
                doc.setTextColor(146, 0, 191)
                nameText = "STAFF"
            } else if (info.wcaid == null) {
                doc.setTextColor(0, 0, 196)
                nameText = "NEWCOMER"
            }
            if (settings.includeCompetitorId && info.compid) {
                nameText += ` - ID ${info.compid}`
            }

            doc.text(nameText, badgeHeight / 2, nameStart + 7, {
                align: "center",
            })
        }
        doc.setTextColor(0, 0, 0)

        // Add logos
        let wcaRatio = $("#wca-img").width() / $("#wca-img").height()
        doc.addImage($("#wca-img")[0], "PNG", 3, halfWidth - 13, 9 * wcaRatio, 9, "wca", "SLOW")

        if (settings.includeOrgLogo) {
            let orgRatio = $("#org-img").width() / $("#org-img").height()
            doc.addImage($("#org-img")[0], "PNG", badgeHeight - (10 * orgRatio) - 3, halfWidth - 13, 10 * orgRatio, 10, "org", "SLOW")
        }

        // Add country flag
        if (!info.blank) {
            let flagRatio = $(`#${info.countryCode}-flag`).width() / $(`#${info.countryCode}-flag`).height()
            let flagWidth = flagRatio * 5
            doc.addImage($(`#${info.countryCode}-flag`)[0], "PNG", (badgeHeight - flagWidth) / 2, halfWidth - 8, flagWidth, 5, `${info.countryCode}-flag`, "SLOW")

            if (NO_FLAG_BORDERS[info.countryCode.toUpperCase()] == undefined) {
                doc.setLineWidth(0.1)
                doc.setDrawColor(0, 0, 0)
                doc.rect((badgeHeight - flagWidth) / 2, halfWidth - 8, flagWidth, 5)
            }
        }

        doc.restoreGraphicsState()
    }

    // Schedule side
    {
        doc.saveGraphicsState()

        doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, mmToPdf(tx), mmToPdf(ty)))

        if (info.compid !== null && info.compid !== '-') {
            // Place name
            drawName(doc, info.name, "left", 3, 7, halfWidth - 12, 4)

            // Place registration id
            doc.setFont("NotoSans-Regular")
            doc.setFontSize(7)
            doc.text(`${info.compid}`, halfWidth - 6, 6, {
                align: "center",
            })

            // Place schedule
            let height = drawSchedule(doc, 3, 10, halfWidth - 6, info)

            // WCA Live QR code is assumed to be square
            // We don't draw it if the schedule extended down too far
            if (settings.showWcaLiveQrCode && (height + 10) < badgeHeight - 20) {
                doc.addImage($("#qrcode-img")[0], "PNG", halfWidth - 18, badgeHeight - 18, 15, 15, "qrcode", "SLOW")
                doc.setFontSize(8)
                doc.setFont("NotoSans-Regular")
                let wcaLiveLines = doc.splitTextToSize(settings.qrcodeMessage, halfWidth - 25)
                let textHeight = wcaLiveLines.length * 4
                let textStart = badgeHeight - 15 + ((15 - textHeight) / 2)
                for (let i = 0; i < wcaLiveLines.length; i++) {
                    doc.text(wcaLiveLines[i], halfWidth - 20, textStart + (i * 4), {
                        align: "right",
                    })
                }
            }
        }

        doc.setLineWidth(0.25)
        doc.setDrawColor(128, 128, 128);
        doc.line(halfWidth, 0, halfWidth, badgeHeight)

        doc.restoreGraphicsState()
    }
}


// Draws an entire A5 portrait name badge for championships
function addChampionshipPortraitNameBadge(doc, index) {

    let info = generatePersonInformation(index)

    // Front name side
    {
        doc.saveGraphicsState()

        // Translate so we are in a landscape A7 space to layout name side
        doc.setCurrentTransformationMatrix(new doc.Matrix(1, 0, 0, 1, mmToPdf(A6P_WIDTH), 0))

        // Add background
        let backgroundRatio = $("#badge-img").height() / $("#badge-img").width()
        doc.addImage($("#badge-img")[0], "PNG", 0, 0, A6P_WIDTH, A6P_WIDTH * backgroundRatio, "background", "SLOW")

        // Place name, starting from bottom and adding extra lines on top for longer names
        if (!info.blank) {
            let [firstLine, secondLine, firstLineLength, secondLineLength] = splitNameOntoTwoLines(doc, info.name, 15, A6P_WIDTH - 10 + 1)
            let scale = 1/Math.max(1, Math.max(firstLineLength, secondLineLength) / (A6P_WIDTH - 10))
            drawName(doc, firstLine, "center", 5, 102, A6P_WIDTH - 10, 13*scale)
            drawName(doc, secondLine, "center", 5, 102 + 10*scale, A6P_WIDTH - 10, 13*scale)
        }

        doc.setLineWidth(0.25)
        doc.setDrawColor(0, 0, 0)
        doc.line(8, 115, A6P_WIDTH - 8, 115)

        // Place WCA ID
        doc.setFont("NotoSans-Regular")
        doc.setFontSize(18)

        if (!info.blank) {
            let nameText = info.wcaid
            if (info.role == "delegate" || info.role == "trainee-delegate") {
                doc.setTextColor(196, 0, 0)
                nameText = "DELEGATE"
            } else if (info.role == "organizer") {
                doc.setTextColor(0, 160, 0)
                nameText = "ORGANIZER"
            } else if (info.role == "staff") {
                doc.setTextColor(146, 0, 191)
                nameText = "STAFF"
            } else if (info.wcaid == null) {
                doc.setTextColor(0, 0, 196)
                nameText = "NEWCOMER"
            }
            if (settings.includeCompetitorId && info.compid) {
                nameText += ` - ID ${info.compid}`
            }

            doc.text(nameText, A6P_WIDTH / 2, 122, {
                align: "center",
            })
        }
        doc.setTextColor(0, 0, 0)

        // Add logos
        let wcaRatio = $("#wca-img").width() / $("#wca-img").height()
        doc.addImage($("#wca-img")[0], "PNG", 5, A6P_HEIGHT - 18, 13 * wcaRatio, 13, "wca", "SLOW")

        if (settings.includeOrgLogo) {
            let orgRatio = $("#org-img").width() / $("#org-img").height()
            doc.addImage($("#org-img")[0], "PNG", A6P_WIDTH - (13 * orgRatio) - 5, A6P_HEIGHT - 18, 13 * orgRatio, 13, "org", "SLOW")
        }

        // Add country flag
        if (!info.blank) {
            let flagRatio = $(`#${info.countryCode}-flag`).width() / $(`#${info.countryCode}-flag`).height()
            let flagWidth = flagRatio * 9
            doc.addImage($(`#${info.countryCode}-flag`)[0], "PNG", (A6P_WIDTH - flagWidth) / 2, A6P_HEIGHT - 23, flagWidth, 9, `${info.countryCode}-flag`, "SLOW")

            if (NO_FLAG_BORDERS[info.countryCode.toUpperCase()] == undefined) {
                doc.setLineWidth(0.2)
                doc.setDrawColor(0, 0, 0)
                doc.rect((A6P_WIDTH - flagWidth) / 2, A6P_HEIGHT - 23, flagWidth, 9)
            }
        }

        doc.restoreGraphicsState()
    }

    // Schedule side
    {
        doc.saveGraphicsState()

        if (info.compid !== null && info.compid !== '-') {
            // Place name
            drawName(doc, info.name, "left", 6, 10, A6P_WIDTH - 20, 6)

            // Place registration id
            doc.setFont("NotoSans-Regular")
            doc.setFontSize(7)
            doc.text(`${info.compid}`, A6P_WIDTH - 9, 8, {
                align: "center",
            })

            // Place schedule
            let height = drawSchedule(doc, 7, 15, A6P_WIDTH - 14, info, 1.2)

            // WCA Live QR code is assumed to be square
            // We don't draw it if the schedule extended down too far
            if (settings.showWcaLiveQrCode && (height + 10) < A6P_HEIGHT - 30) {
                doc.addImage($("#qrcode-img")[0], "PNG", A6P_WIDTH - 25, A6P_HEIGHT - 25, 20, 20, "qrcode", "SLOW")
                doc.setFontSize(13)
                doc.setFont("NotoSans-Regular")
                let wcaLiveLines = doc.splitTextToSize(settings.qrcodeMessage, A6P_WIDTH - 35)
                let textHeight = wcaLiveLines.length * 6
                let textStart = A6P_HEIGHT - 20 + ((20 - textHeight) / 2)
                for (let i = 0; i < wcaLiveLines.length; i++) {
                    doc.text(wcaLiveLines[i], A6P_WIDTH - 28, textStart + (i * 6), {
                        align: "right",
                    })
                }
            }
        }

        doc.setLineWidth(0.25)
        doc.setDrawColor(128, 128, 128);
        doc.line(A5L_WIDTH / 2, 0, A5L_WIDTH / 2, A5L_HEIGHT)

        doc.restoreGraphicsState()
    }
}

// Draw a standard certificate for podium winners
function addCertificate(doc, eventIndex, place, dateText, tintedImage, blank=false, otherEventText = "", otherResultPrefixText = "") {
    // Get event specific text
    let eventText = ""
    let resultPrefixText = ""
    let placeText = "Awarded to:"
    if (!blank) {
        eventText = EVENT_MAP[wcif.events[eventIndex].id]
        resultPrefixText = EVENT_FORMAT_MAP[wcif.events[eventIndex].rounds[wcif.events[eventIndex].rounds.length - 1].format]
        if (wcif.events[eventIndex].id == "333mbf") {
            resultPrefixText = MULTIBLIND_FORMAT_TEXT
        }
        if (wcif.events[eventIndex].id == "333fm") {
            resultPrefixText = FEWEST_MOVES_FORMAT_TEXT
        }
        placeText = PLACE_MAP[place]
    }

    if (otherEventText != "") {
        eventText = otherEventText
    }
    if (otherResultPrefixText != "") {
        resultPrefixText = otherResultPrefixText
    }

    let pageColor = hexToRgb(settings.certPageColor)
    let textColor = hexToRgb(settings.certTextColor)

    // Draw the certificate
    // Add page
    doc.setFillColor(pageColor[0], pageColor[1], pageColor[2])
    doc.rect(0, 0, A4L_WIDTH, A4L_HEIGHT, "F")

    // Add background
    let backgroundRatio = tintedImage.height / tintedImage.width
    doc.addImage(tintedImage, "PNG", 0, 0, A4L_WIDTH, A4L_WIDTH * backgroundRatio, "background", "SLOW")

    let logoMargins = settings.certThinMargins ? [5.0, 5.0] : [22.0, 22.0]
    let logoHeight = 28.0

    // Add logos
    let wcaRatio = $("#wca-large-img").width() / $("#wca-large-img").height()
    doc.addImage($("#wca-large-img")[0], "PNG", logoMargins[0], logoMargins[1], logoHeight * wcaRatio, logoHeight, "wca-large", "SLOW")

    if (settings.includeOrgLogo) {
        let orgRatio = $("#org-img").width() / $("#org-img").height()
        doc.addImage($("#org-img")[0], "PNG", A4L_WIDTH - logoMargins[0] - (logoHeight * orgRatio), logoMargins[1], logoHeight * orgRatio, logoHeight, "org", "SLOW")
    }

    // Add Main text
    doc.setFont("Barmeno-Regular")
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    drawText(doc, wcif.name, "center", 10, 76, A4L_WIDTH - 20, 21)
    drawText(doc, eventText, "center", 10, 95, A4L_WIDTH - 20, 21)
    drawText(doc, placeText, "center", 10, 108, A4L_WIDTH - 20, 11)
    doc.setFontSize(22)
    doc.text(resultPrefixText, (A4L_WIDTH / 2) - 2, 139, {
        align: "right",
    })

    // Add empty boxes
    doc.setFillColor(255, 255, 255)
    doc.rect(68, 110, 161, 15, "F")
    doc.rect(A4L_WIDTH / 2, 129, 70, 13, "F")

    // Add date and signature
    let bottomHeight = logoMargins[1] + 18
    doc.setLineWidth(0.75)
    doc.setDrawColor(textColor[0], textColor[1], textColor[2])
    doc.line(logoMargins[0], A4L_HEIGHT - bottomHeight, logoMargins[0] + 60, A4L_HEIGHT - bottomHeight)
    doc.line(A4L_WIDTH - logoMargins[0], A4L_HEIGHT - bottomHeight, A4L_WIDTH - logoMargins[0] - 60, A4L_HEIGHT - bottomHeight)

    drawText(doc, dateText, "center", logoMargins[0] - 5, A4L_HEIGHT - bottomHeight - 3, 70, 9)
    drawText(doc, settings.certRole, "center", A4L_WIDTH - logoMargins[0] - 65, A4L_HEIGHT - bottomHeight + 14, 70, 8)

    drawText(doc, "DATE", "center", logoMargins[0] - 5, A4L_HEIGHT - bottomHeight + 7, 70, 8)
    drawText(doc, settings.certOrganiser, "center", A4L_WIDTH - logoMargins[0] - 65, A4L_HEIGHT - bottomHeight + 7, 70, 9)
}

// Make a preview or full document from user specified settings
function makeDocument(preview = false) {

    if (wcif == undefined) {
        setStatus("Cannot generate document: WCIF not provided yet", STATUS_MODE_ERROR)
        return false
    }

    // Name badges should only be for accepted people and in alphabetical order
    persons = wcif.persons.filter((a) => {
        if (a.registration != null) {
            if (a.registration.status == "accepted") {
                return true
            }
        } else if (a.roles && (a.roles.includes("organizer") || a.roles.includes("delegate"))) {
            // Also include non-competing organizers and delegates
            return true
        }
        return false
    })

    let template = TEMPLATES[settings.template]

    if (preview) {
        // If preview, pick the person with the most assignments, which will likely be the most interesting
        persons.sort((a, b) => {
            return b.assignments.length - a.assignments.length
        })
        persons = [persons[0]]
    } else {
        // Normally we sort by name/newcomer status
        persons.sort((a, b) => {
            let aCat = 0, bCat = 0
            if (a.registration == null) {aCat = 2}
            if (b.registration == null) {bCat = 2}
            if (template.newcomersFirst) {
                if (a.wcaId != null && aCat === 0) {aCat = 1}
                if (b.wcaId != null && bCat === 0) {bCat = 1}
            }
            if (aCat < bCat) {
                return -1
            }
            if (aCat > bCat) {
                return 1
            }
            if (a.name < b.name) {
                return -1
            }
            if (a.name > b.name) {
                return 1
            }
            return 0
        })
    }

    template.generationFunction()

    return true
}

// Function for each format to generate badges

function makeA6LandscapeBadges() {
    // Name badges
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a6',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            break
        }

        // Create a new page
        if (index != 0) {
            globalDoc.addPage("a6", "l")
        }

        // Add badge
        addLandscapeNameBadgeWithDimensions(globalDoc, index, A6L_WIDTH, A6L_HEIGHT, "a6")

        index += 1
    }

    return true
}

function makeA4LandscapeBadges() {
    // Name badges
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            globalDoc.line(A4L_WIDTH / 2, 0, A4L_WIDTH / 2, A4L_HEIGHT)
            globalDoc.line(0, A4L_HEIGHT / 2, A4L_WIDTH, A4L_HEIGHT / 2)
            if (settings.drawOuterBorders) {
                globalDoc.line(0, 0, A4L_WIDTH, 0)
                globalDoc.line(0, A4L_HEIGHT, A4L_WIDTH, A4L_HEIGHT)
                globalDoc.line(0, 0, 0, A4L_HEIGHT)
                globalDoc.line(A4L_WIDTH, 0, A4L_WIDTH, A4L_HEIGHT)
            }
            globalDoc.restoreGraphicsState()
            break
        }

        // Create a new page
        if (index != 0 && (index % 4) == 0) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            globalDoc.line(A4L_WIDTH / 2, 0, A4L_WIDTH / 2, A4L_HEIGHT)
            globalDoc.line(0, A4L_HEIGHT / 2, A4L_WIDTH, A4L_HEIGHT / 2)
            if (settings.drawOuterBorders) {
                globalDoc.line(0, 0, A4L_WIDTH, 0)
                globalDoc.line(0, A4L_HEIGHT, A4L_WIDTH, A4L_HEIGHT)
                globalDoc.line(0, 0, 0, A4L_HEIGHT)
                globalDoc.line(A4L_WIDTH, 0, A4L_WIDTH, A4L_HEIGHT)
            }
            globalDoc.restoreGraphicsState()
            globalDoc.addPage("a4", "l")
        }

        globalDoc.saveGraphicsState()

        // Add badge
        // Translate badge to different spot
        addLandscapeNameBadgeWithDimensions(globalDoc, index, A6L_WIDTH, A6L_HEIGHT, "a4", (index & 0x1) * A4L_WIDTH / 2, (index & 0x2) * -A4L_HEIGHT / 4)

        globalDoc.restoreGraphicsState()

        index += 1
    }

    return true
}

function makeA6PortraitBadges() {
    // Name badges
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a6',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            break
        }

        // Create a new page
        if (index != 0) {
            globalDoc.addPage("a6", "l")
        }

        // Add badge
        addPortraitNameBadgeWithDimensions(globalDoc, index, A6L_WIDTH, A6L_HEIGHT)

        index += 1
    }

    return true
}

function makeA4PortraitBadges() {
    // Name badges 
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            globalDoc.line(A4L_WIDTH / 2, 0, A4L_WIDTH / 2, A4L_HEIGHT)
            globalDoc.line(0, A4L_HEIGHT / 2, A4L_WIDTH, A4L_HEIGHT / 2)
            if (settings.drawOuterBorders) {
                globalDoc.line(0, 0, A4L_WIDTH, 0)
                globalDoc.line(0, A4L_HEIGHT, A4L_WIDTH, A4L_HEIGHT)
                globalDoc.line(0, 0, 0, A4L_HEIGHT)
                globalDoc.line(A4L_WIDTH, 0, A4L_WIDTH, A4L_HEIGHT)
            }
            globalDoc.restoreGraphicsState()
            break
        }

        // Create a new page
        if (index != 0 && (index % 4) == 0) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            globalDoc.line(A4L_WIDTH / 2, 0, A4L_WIDTH / 2, A4L_HEIGHT)
            globalDoc.line(0, A4L_HEIGHT / 2, A4L_WIDTH, A4L_HEIGHT / 2)
            if (settings.drawOuterBorders) {
                globalDoc.line(0, 0, A4L_WIDTH, 0)
                globalDoc.line(0, A4L_HEIGHT, A4L_WIDTH, A4L_HEIGHT)
                globalDoc.line(0, 0, 0, A4L_HEIGHT)
                globalDoc.line(A4L_WIDTH, 0, A4L_WIDTH, A4L_HEIGHT)
            }
            globalDoc.restoreGraphicsState()
            globalDoc.addPage("a4", "l")
        }

        globalDoc.saveGraphicsState()

        // Add badge
        // Translate badge to different spot
        addPortraitNameBadgeWithDimensions(globalDoc, index, A6L_WIDTH, A6L_HEIGHT, (index & 0x1) * A4L_WIDTH / 2, (index & 0x2) * -A4L_HEIGHT / 4)

        globalDoc.restoreGraphicsState()

        index += 1
    }

    return true
}

function makeLetterPortraitBadges() {
    // Name badges 
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'letter',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            globalDoc.line(LETTERL_WIDTH / 2, 0, LETTERL_WIDTH / 2, LETTERL_HEIGHT)
            globalDoc.line(0, LETTERL_HEIGHT / 2, LETTERL_WIDTH, LETTERL_HEIGHT / 2)
            if (settings.drawOuterBorders) {
                globalDoc.line(0, 0, LETTERL_WIDTH, 0)
                globalDoc.line(0, LETTERL_HEIGHT, LETTERL_WIDTH, LETTERL_HEIGHT)
                globalDoc.line(0, 0, 0, LETTERL_HEIGHT)
                globalDoc.line(LETTERL_WIDTH, 0, LETTERL_WIDTH, LETTERL_HEIGHT)
            }
            globalDoc.restoreGraphicsState()
            break
        }

        // Create a new page
        if (index != 0 && (index % 4) == 0) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            globalDoc.line(LETTERL_WIDTH / 2, 0, LETTERL_WIDTH / 2, LETTERL_HEIGHT)
            globalDoc.line(0, LETTERL_HEIGHT / 2, LETTERL_WIDTH, LETTERL_HEIGHT / 2)
            if (settings.drawOuterBorders) {
                globalDoc.line(0, 0, LETTERL_WIDTH, 0)
                globalDoc.line(0, LETTERL_HEIGHT, LETTERL_WIDTH, LETTERL_HEIGHT)
                globalDoc.line(0, 0, 0, LETTERL_HEIGHT)
                globalDoc.line(LETTERL_WIDTH, 0, LETTERL_WIDTH, LETTERL_HEIGHT)
            }
            globalDoc.restoreGraphicsState()
            globalDoc.addPage("letter", "l")
        }

        globalDoc.saveGraphicsState()

        // Add badge
        // Translate badge to different spot
        addPortraitNameBadgeWithDimensions(globalDoc, index, LETTERL_WIDTH / 2, LETTERL_HEIGHT / 2, (index & 0x1) * LETTERL_WIDTH / 2, (index & 0x2) * - LETTERL_HEIGHT / 4)

        globalDoc.restoreGraphicsState()

        index += 1
    }

    return true
}

function makeLetterLandscapeBadges() {
    // Name badges 
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'letter',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            globalDoc.line(LETTERL_WIDTH / 2, 0, LETTERL_WIDTH / 2, LETTERL_HEIGHT)
            globalDoc.line(0, LETTERL_HEIGHT / 2, LETTERL_WIDTH, LETTERL_HEIGHT / 2)
            if (settings.drawOuterBorders) {
                globalDoc.line(0, 0, LETTERL_WIDTH, 0)
                globalDoc.line(0, LETTERL_HEIGHT, LETTERL_WIDTH, LETTERL_HEIGHT)
                globalDoc.line(0, 0, 0, LETTERL_HEIGHT)
                globalDoc.line(LETTERL_WIDTH, 0, LETTERL_WIDTH, LETTERL_HEIGHT)
            }
            globalDoc.restoreGraphicsState()
            break
        }

        // Create a new page
        if (index != 0 && (index % 4) == 0) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            globalDoc.line(LETTERL_WIDTH / 2, 0, LETTERL_WIDTH / 2, LETTERL_HEIGHT)
            globalDoc.line(0, LETTERL_HEIGHT / 2, LETTERL_WIDTH, LETTERL_HEIGHT / 2)
            if (settings.drawOuterBorders) {
                globalDoc.line(0, 0, LETTERL_WIDTH, 0)
                globalDoc.line(0, LETTERL_HEIGHT, LETTERL_WIDTH, LETTERL_HEIGHT)
                globalDoc.line(0, 0, 0, LETTERL_HEIGHT)
                globalDoc.line(LETTERL_WIDTH, 0, LETTERL_WIDTH, LETTERL_HEIGHT)
            }
            globalDoc.restoreGraphicsState()
            globalDoc.addPage("letter", "l")
        }

        globalDoc.saveGraphicsState()

        // Add badge
        // Translate badge to different spot
        addLandscapeNameBadgeWithDimensions(globalDoc, index, LETTERL_WIDTH / 2, LETTERL_HEIGHT / 2, "letter", (index & 0x1) * LETTERL_WIDTH / 2, (index & 0x2) * - LETTERL_HEIGHT / 4)

        globalDoc.restoreGraphicsState()

        index += 1
    }

    return true
}

function makeFourBySixPortraitBadges() {
    // Name badges
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: [152.4, 101.6],
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            break
        }

        // Create a new page
        if (index != 0) {
            globalDoc.addPage([152.4, 101.6], "l")
        }

        // Add badge
        addPortraitNameBadgeWithDimensions(globalDoc, index, FOURBYSIXL_WIDTH, FOURBYSIXL_HEIGHT, 0, 0)

        index += 1
    }

    return true
}

function makeFourBySixLandscapeBadges() {
    // Name badges
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: [152.4, 101.6],
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            break
        }

        // Create a new page
        if (index != 0) {
            globalDoc.addPage([152.4, 101.6], "l")
        }

        // Add badge
        addLandscapeNameBadgeWithDimensions(globalDoc, index, FOURBYSIXL_WIDTH, FOURBYSIXL_HEIGHT, "4x6", false, 0, 0)

        index += 1
    }

    return true
}

function makeLetterSmallPortraitBadges() {
    const WIDTH = 57.15 * 2; // 2.25 inches * 2 sides
    const HEIGHT = 88.9; // 3.5 inches
    const MARGIN_WIDTH = (LETTERL_WIDTH - (WIDTH * 2)) / 2
    const MARGIN_HEIGHT = (LETTERL_HEIGHT - (HEIGHT * 2)) / 2

    // Name badges
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'letter',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            let top = MARGIN_HEIGHT
            let bottom = LETTERL_HEIGHT - MARGIN_HEIGHT
            let left = MARGIN_WIDTH
            let right = LETTERL_WIDTH - MARGIN_WIDTH
            globalDoc.line(LETTERL_WIDTH / 2, top, LETTERL_WIDTH / 2, bottom)
            globalDoc.line(left, LETTERL_HEIGHT / 2, right, LETTERL_HEIGHT / 2)
            globalDoc.line(left, top, right, top)
            globalDoc.line(left, bottom, right, bottom)
            globalDoc.line(left, top, left, bottom)
            globalDoc.line(right, top, right, bottom)
            globalDoc.restoreGraphicsState()
            break
        }

        // Create a new page
        if (index != 0 && (index % 4) == 0) {
            globalDoc.saveGraphicsState()
            globalDoc.setLineWidth(0.25)
            globalDoc.setLineDash([1])
            globalDoc.setDrawColor(128, 128, 128)
            let top = MARGIN_HEIGHT
            let bottom = LETTERL_HEIGHT - MARGIN_HEIGHT
            let left = MARGIN_WIDTH
            let right = LETTERL_WIDTH - MARGIN_WIDTH
            globalDoc.line(LETTERL_WIDTH / 2, top, LETTERL_WIDTH / 2, bottom)
            globalDoc.line(left, LETTERL_HEIGHT / 2, right, LETTERL_HEIGHT / 2)
            globalDoc.line(left, top, right, top)
            globalDoc.line(left, bottom, right, bottom)
            globalDoc.line(left, top, left, bottom)
            globalDoc.line(right, top, right, bottom)
            globalDoc.restoreGraphicsState()
            globalDoc.addPage("letter", "l")
        }

        globalDoc.saveGraphicsState()

        // Add badge
        // Translate badge to different spot
        addPortraitNameBadgeWithDimensions(globalDoc, index, WIDTH, HEIGHT, MARGIN_WIDTH + (index & 0x1) * WIDTH, -MARGIN_HEIGHT + (index & 0x2) * -HEIGHT / 2)

        globalDoc.restoreGraphicsState()

        index += 1
    }

    return true
}

function makeChampionshipPortraitBadges() {
    // Name badges
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a5',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length + settings.placeholderQuantity)) {
            break
        }

        // Create a new page
        if (index != 0) {
            globalDoc.addPage("a5", "l")
        }

        // Add badge
        addChampionshipPortraitNameBadge(globalDoc, index, false, 0, 0)

        index += 1
    }

    return true
}

function makeCertificates() {

    // Convert and tint background
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4',
    })

    // Create tinted image
    let tintedImage = createTintedImage($("#certificate-img")[0], hexToRgb(settings.certBackgroundTint))
    tintedImage.width = $("#certificate-img").width()
    tintedImage.height = $("#certificate-img").height()

    // Get date text
    let certDate = moment(wcif.schedule.startDate).add(wcif.schedule.numberOfDays - 1, 'days')
    certDate = certDate.format("D MMMM Y")

    // For each event and a blank
    for (let e = 0; e < wcif.events.length ; e++) {
        // Create first, second and third certificates for events
        for (let p = 2; p >= 0; p--) {
            // Create a new page
            if (e != 0 || p != 2) {
                globalDoc.addPage("a4", "l")
            }
            addCertificate(globalDoc, e, p, certDate, tintedImage)
        }
    }
    // Add last blank page
    globalDoc.addPage("a4", "l")
    addCertificate(globalDoc, 0, 0, certDate, tintedImage, blank=true)

    return true
}

function makeCustomCertificates() {
    // Convert and tint background
    globalDoc = new jspdf.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4',
    })

    // Create tinted image
    let tintedImage = createTintedImage($("#certificate-img")[0], hexToRgb(settings.certBackgroundTint))
    tintedImage.width = $("#certificate-img").width()
    tintedImage.height = $("#certificate-img").height()

    // Get date text
    let certDate = moment(wcif.schedule.startDate).add(wcif.schedule.numberOfDays - 1, 'days')
    certDate = certDate.format("D MMMM Y")

    // Create first, second and third certificates for events
    for (let p = 2; p >= 0; p--) {
        // Create a new page
        if (p != 2) {
            globalDoc.addPage("a4", "l")
        }

        addCertificate(globalDoc, 0, p, certDate, tintedImage, false, settings.customCertEventName, settings.customCertResultPrefix)
    }

    return true
}

function makeParticipationCertificates() {
    // Name badges
    globalDoc = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
    })

    // Keep track of pages and badges
    let index = 0
    while (true) {
        if (index >= (persons.length)) {
            break
        }

        // Create a new page
        if (index != 0) {
            globalDoc.addPage("a4", "p")
        }

        let info = generatePersonInformation(index)

        const BASE = 129

        let backgroundRatio = $("#badge-img").height() / $("#badge-img").width()
        globalDoc.addImage($("#badge-img")[0], "PNG", 0, 0, A4P_WIDTH, A4P_WIDTH * backgroundRatio, "background", "SLOW")

        // Place name, starting from bottom and adding extra lines on top for longer names
        drawName(globalDoc, info.name, "center", 10, BASE + 13, A4P_WIDTH - 20, 20, "Oswald-SemiBold")

        // Place WCA
        if (info.wcaid != null) {
            globalDoc.setFont("Oswald-SemiBold")
            globalDoc.setFontSize(25)
            let nameText = "" + info.wcaid
            globalDoc.text(nameText, A4P_WIDTH / 2, BASE + 25, {
                align: "center",
            })
        }

        // Add representing
        globalDoc.setFont("Oswald-Regular")
        globalDoc.setFontSize(20)
        globalDoc.text("Representing", A4P_WIDTH / 2, BASE + 36, {
            align: "center",
        })

        // Add country flag and name
        let flagRatio = $(`#${info.countryCode}-flag`).width() / $(`#${info.countryCode}-flag`).height()
        let flagWidth = flagRatio * 20
        globalDoc.addImage($(`#${info.countryCode}-flag`)[0], "PNG", (A4P_WIDTH - flagWidth) / 2, BASE + 40, flagWidth, 20, `${info.countryCode}-flag`, "SLOW")
        if (NO_FLAG_BORDERS[info.countryCode.toUpperCase()] == undefined) {
            globalDoc.setLineWidth(0.4)
            globalDoc.setDrawColor(0, 0, 0)
            globalDoc.rect((A4P_WIDTH - flagWidth) / 2, BASE + 40, flagWidth, 20)
        }

        globalDoc.setFontSize(20)
        globalDoc.text(getCountryName(persons[index].countryIso2), A4P_WIDTH / 2, BASE + 67, {
            align: "center",
        })

        // Add qualifying text
        globalDoc.setFontSize(20)
        let nameText = info.wcaid
        globalDoc.text("Qualified and Participated in", A4P_WIDTH / 2, BASE + 80, {
            align: "center",
        })

        // Add events
        let inEvents = new Array(EVENT_COUNT).fill(false)
        for (let a = 0; a < persons[index].assignments.length; a++) {
            let assignment = persons[index].assignments[a];
            let activity = activities[assignment.activityId];
            let codes = activity.activityCode.split('-')
            let event = codes[0]
            if (assignment.assignmentCode == "competitor") {
                inEvents[EVENT_ORDER[event]] = true
            }
        }

        let eventText = ""
        for (let e = 0; e < EVENT_COUNT; e++) {
            if (inEvents[e]) {
                eventText += EVENT_CHARACTERS[EVENT_ORDER_NAME[e]]
            }
        }

        globalDoc.setFontSize(30)
        globalDoc.setFont("cubing-icons")
        globalDoc.text(eventText, A4P_WIDTH / 2, BASE + 93, {
            align: "center",
            horizontalScale: 1,
        })

        index += 1
    }

    return true
}
