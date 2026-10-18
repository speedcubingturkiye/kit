
const TEMPLATES = [
    {
        name: "A6 Landscape",
        description: "Individual A7 landscape badges and schedule for printing on A6 paper",
        generationFunction: makeA6LandscapeBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/a7-placeholder.png",
        imageDescription: "Background images should be landscape A7 size (105mm x 74.25mm) or 1241px x 877px is recommended. The top 50mm (591px) is available for your competitions logo. The bottom 24.25mm (286px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "A6 Portrait",
        description: "Individual A7 portrait badges and schedule for printing on A6 paper",
        generationFunction: makeA6PortraitBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/a7p-placeholder.png",
        imageDescription: "Background images should be portrait A7 size (74.25mm x 105mm) or 877px x 1241px is recommended. The top 64mm (756px) is available for your competitions logo. The bottom 41mm (485px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "A4 Landscape 2x2",
        description: "4x A7 landscape badges and schedules for printing on A4 paper",
        generationFunction: makeA4LandscapeBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/a7-placeholder.png",
        imageDescription: "Background images should be landscape A7 size (105mm x 74.25mm) or 1241px x 877px is recommended. The top 50mm (591px) is available for your competitions logo. The bottom 24.25mm (286px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "A4 Portrait 2x2",
        description: "4x A7 portrait badges and schedules for printing on A4 paper",
        generationFunction: makeA4PortraitBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/a7p-placeholder.png",
        imageDescription: "Background images should be portrait A7 size (74.25mm x 105mm) or 877px x 1241px is recommended. The top 64mm (756px) is available for your competitions logo. The bottom 41mm (485px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "4\"x6\" Landscape",
        description: "Individual 4\"x3\" landscape badges and schedule for printing on 4\"x6\" paper",
        generationFunction: makeFourBySixLandscapeBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/4x6l-placeholder.png",
        imageDescription: "Background images should be half portrait 4x6 size (101.6mm x 76.2mm) or 1200px x 900px is recommended. The top 5400px is available for your competitions logo. The bottom 41mm (485px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "4\"x6\" Portrait",
        description: "Individual 4\"x3\" portrait badges and schedule for printing on 4\"x6\" paper",
        generationFunction: makeFourBySixPortraitBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/4x6p-placeholder.png",
        imageDescription: "Background images should be half portrait 4x6 size (76.2mm x 101.6mm) or 900px x 1200px is recommended. The top 720px is available for your competitions logo. The bottom 41mm (485px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "Letter Landscape 2x2",
        description: "4x 4.25\"x2.75\" landscape badges and schedules for printing on US Letter paper",
        generationFunction: makeLetterLandscapeBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/letterl-placeholder.png",
        imageDescription: "Background images should be 1/4th portrait letter size (107.95mm x 69.85mm) or 1275px x 825px is recommended. The top 495px is available for your competitions logo. The bottom 41mm (485px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "Letter Portrait 2x2",
        description: "4x 4.25\"x2.75\" portrait badges and schedules for printing on US Letter paper",
        generationFunction: makeLetterPortraitBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/letterp-placeholder.png",
        imageDescription: "Background images should be 1/4th portrait letter size (69.85mm x 107.95mm) or 825px x 1275px is recommended. The top 765px is available for your competitions logo. The bottom 41mm (485px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "Small Letter Portrait 2x2",
        description: "4x 3.5\"x2.25\" portrait badges and schedules for printing on US Letter paper",
        generationFunction: makeLetterSmallPortraitBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/letterp-placeholder.png",
        imageDescription: "Background images should be 57.15mm x 88.9mm or 675px x 1050px is recommended. The top 350px is available for your competitions logo. The bottom 325px is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "A5 Championship Portrait",
        description: "Individual A6 portrait badges and schedule for printing on A5 pages, designed for championship events",
        generationFunction: makeChampionshipPortraitBadges,
        type: "badge",
        newcomersFirst: true,
        placeholderImage: "assets/a7p-placeholder.png",
        imageDescription: "Background images should be portrait A6 size (105mm x 148.5mm) or 1241px x 1754px is recommended. The top 90mm (1070px) is available for your competitions logo. The bottom 58.5mm (684px) is reserved for badge content and this part of your image should be very simple or blank. PNG or JPEG image formats are recommended.",
    },
    {
        name: "Participation Certificates",
        description: "Certificate for each competitor for individual A4 pages",
        generationFunction: makeParticipationCertificates,
        type: "badge",
        newcomersFirst: false,
        placeholderImage: "assets/participation-cert.png",
        imageDescription: "Background images should be portrait A4 size (210mm x 297mm) or 2480px x 3508px is recommended. The image should include your competition logo at the top, all organization logos, signatures and background/border elements. PNG or JPEG image formats are recommended.",
    },
    {
        name: "Podium Certificates",
        description: "Landscape certificates for all events",
        generationFunction: makeCertificates,
        type: "certificate",
        newcomersFirst: false,
    },
    {
        name: "Custom Certificates",
        description: "Landscape certificates with a custom event title",
        generationFunction: makeCustomCertificates,
        type: "customCertificate",
        newcomersFirst: false,
    },
]

// Settings
var settings = {
    // General settings
    template: 0,
    // Badge settings
    includeOrgLogo: true,
    includeTimes: true,
    includeStaffing: false,
    includeStations: false,
    includeStages: false,
    includeLocalName: false,
    includeCompetitorId: false,
    hideStaffOnlyAssignments: false,
    showWcaLiveQrCode: true,
    customScheduleColors: false,
    customScheduleColorsCode: "",
    colorFromStage: false,
    qrcodeLink: "https://live.worldcubeassociation.org/",
    qrcodeMessage: "Live results and full schedule available on WCA Live. Good luck and have fun!",
    drawOuterBorders: false,
    placeholderQuantity: 1,
    placeholderName: "",
    // Certificate settings
    certOrganiser: "Name",
    certRole: "WCA DELEGATE",
    certBackgroundTint: "#006400",
    certPageColor: "#dfefdf",
    certTextColor: "#005400",
    certThinMargins: false,
    // Custom Certificate settings
    customCertEventName: "",
    customCertResultPrefix: "Average of:"
}

var activities
var wcif
var hasReadBadgeBackgroundImage = false
var qrcode

// Set status text
const STATUS_MODE_INFO = 0
const STATUS_MODE_WARN = 1
const STATUS_MODE_ERROR = 2
function setStatus(text, mode) {
    $("#status").removeClass()
    $("#status").text(text)
    if (mode == STATUS_MODE_WARN) {
        $("#status").addClass("warn")
    } else if (mode == STATUS_MODE_ERROR) {
        $("#status").addClass("error")
    } else {
        $("#status").addClass("info")
    }
}

function setWcifStatus(text, mode) {
    $("#wcif-status").removeClass()
    $("#wcif-status").text(text)
    if (mode == STATUS_MODE_WARN) {
        $("#wcif-status").addClass("warn")
    } else if (mode == STATUS_MODE_ERROR) {
        $("#wcif-status").addClass("error")
    } else {
        $("#wcif-status").addClass("info")
    }
}

function getActivities() {
    // Reorganise activity information
    activities = {}
    for (var v = 0; v < wcif.schedule.venues.length; v++) {
        var venue = wcif.schedule.venues[v]
        for (var r = 0; r < venue.rooms.length; r++) {
            var room = venue.rooms[r]
            for (var a = 0; a < room.activities.length; a++) {
                var activity = room.activities[a]

                // Room color is a mix between room color and white for visibility
                var roomColor = hexToRgb(room.color)
                roomColor[0] = (255 + roomColor[0]) / 2
                roomColor[1] = (255 + roomColor[1]) / 2
                roomColor[2] = (255 + roomColor[2]) / 2

                activities[activity.id] = {
                    parentActivityCode: activity.activityCode,
                    activityCode: activity.activityCode,
                    roundStartTime: activity.startTime,
                    roundEndTime: activity.endTime,
                    timezone: venue.timezone,
                    roomName: room.name,
                    roomColor: roomColor,
                }

                for (var c = 0; c < activity.childActivities.length; c++) {
                    var childActivity = activity.childActivities[c]

                    activities[childActivity.id] = {
                        parentActivityCode: activity.activityCode,
                        activityCode: childActivity.activityCode,
                        roundStartTime: activity.startTime,
                        roundEndTime: activity.endTime,
                        timezone: venue.timezone,
                        roomName: room.name,
                        roomColor: roomColor,
                    }
                }
            }
        }
    }
}

// Load images of all the countries referenced in the WCIF
function loadCountryFlags() {
    var flags = {}

    for (var person in wcif.persons) {
        var code = wcif.persons[person].countryIso2.toLowerCase()
        if (flags[code] == undefined) {
            flags[code] = true
            var flagElement = $(`<img style="display: none;" id='${code}-flag' src='${getCountryFlag(code)}'/>`)
            $("#hidden-images").append(flagElement)
            console.log(`Added flag: ${code}`)
        }
    }
}

// Load a WCIF file from the user
function readWCIF(input) {
    // Get file
    let file = input.files[0];
    let fileReader = new FileReader();
    fileReader.readAsText(file);
    fileReader.onload = function () {
        // Check WCIF
        try {
            wcif = JSON.parse(fileReader.result)
            $("#wcifFileLabel").text(file.name)

            getActivities()
            loadCountryFlags()
        } catch {
            setWcifStatus("Invalid WCIF file provided: Couldn't parse JSON", STATUS_MODE_ERROR)
            return
        }
        if (wcif == undefined) {
            setWcifStatus("Invalid WCIF file provided: Couldn't parse JSON", STATUS_MODE_ERROR)
            return
        }

        setWcifStatus("Loaded WCIF file", STATUS_MODE_INFO)
    };
    fileReader.onerror = function () {
        setWcifStatus("Couldn't read WCIF file", STATUS_MODE_ERROR)
    };
}

function fetchWCIF() {
    setWcifStatus("Fetching WCIF...", STATUS_MODE_INFO)
    setTimeout(() => {
        let id = $("#wcif-compid")[0].value
        let url = `https://www.worldcubeassociation.org/api/v0/competitions/${id}/wcif/public`
        let request = new XMLHttpRequest()
        request.open('GET', url, false)
        request.send()

        if (request.status === 200) {
            try {
                wcif = JSON.parse(request.response)
                setWcifStatus("Loaded WCIF", STATUS_MODE_INFO)
                getActivities()
                loadCountryFlags()
            } catch (error) {
                console.error(error)
                setWcifStatus("Invalid WCIF ", STATUS_MODE_ERROR)
            }
        } else {
            setWcifStatus("Loaded demo WCIF file", STATUS_MODE_ERROR)
        }
    }, 100)
}

function useDemoWCIF() {
    wcif = DEMO_WCIF
    setWcifStatus("Loaded demo WCIF", STATUS_MODE_INFO)
    getActivities()
    loadCountryFlags()
}

// Read badge background image from user
function readBadgeBackgroundImage(input) {
    let file = input.files[0];
    let fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = function () {
        $("#badge-img").attr("src", fileReader.result)
        $("#badgeBackgroundImgLabel").text(file.name)

        hasReadBadgeBackgroundImage = true
        setStatus("Updated badge background image", STATUS_MODE_INFO)
    };
    fileReader.onerror = function () {
        setStatus("Couldn't read image file", STATUS_MODE_ERROR)
    };
}

// Read certificate background image from user
function readCertBackgroundImage(input) {
    let file = input.files[0];
    let fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = function () {
        $("#certificate-img").attr("src", fileReader.result)
        $("#certBackgroundImgLabel").text(file.name)

        setStatus("Updated certificate background image", STATUS_MODE_INFO)
    };
    fileReader.onerror = function () {
        setStatus("Couldn't read image file", STATUS_MODE_ERROR)
    };

    $("#cert-background-tint-input").data().colorpicker.setValue("#FFFFFF")
    $("#cert-page-color-input").data().colorpicker.setValue("#FFFFFF")
    $("#cert-text-color-input").data().colorpicker.setValue("#000000")
}

// Read organization image from user
function readOrganizationImage(input) {
    let file = input.files[0];
    let fileReader = new FileReader();
    fileReader.readAsDataURL(file);
    fileReader.onload = function () {
        organizationImage = fileReader.result

        // Add organization image css to style badges
        $("#org-img").attr("src", organizationImage)
        $("#orgLogoLabel").text(file.name)

        setStatus("Updated organization image", STATUS_MODE_INFO)
    };
    fileReader.onerror = function () {
        setStatus("Couldn't read image file", STATUS_MODE_ERROR)
    };
}

// Template has been selected, chang settings and UI
function templateChanged(select) {
    settings.template = Number(select.value)
    $("#template-description").text(TEMPLATES[settings.template].description)

    if (TEMPLATES[settings.template].type == "badge") {
        $(".badge-only").show()
        $(".certificate-only").hide()
        $(".custom-certificate-only").hide()
        if (!hasReadBadgeBackgroundImage) {
            $("#badge-img").attr("src", TEMPLATES[settings.template].placeholderImage)
            $("#badge-image-description").text(TEMPLATES[settings.template].imageDescription)
        }
    } else if (TEMPLATES[settings.template].type == "certificate") {
        $(".badge-only").hide()
        $(".certificate-only").show()
        $(".custom-certificate-only").hide()
    } else if (TEMPLATES[settings.template].type == "customCertificate") {
        $(".badge-only").hide()
        $(".certificate-only").show()
        $(".custom-certificate-only").show()
    }
}

// Template has been selected, chang settings and UI
function useCustomColorChanged() {
    if (settings.customScheduleColors) {
        $("#customColors").show()
    } else {
        $("#customColors").hide()
    }
}

function updateQrCode() {
    qrcode.makeCode(settings.qrcodeLink)
}

function previewDocument() {
    setStatus("Generating PDF...", STATUS_MODE_INFO)
    settings.customScheduleColorsCode = $("#customColorsCode").val()
    let imgsrc = document.getElementById("qrcode-gen").children[1].src
    document.getElementById("qrcode-img").src = imgsrc
    setTimeout(() => {
        try {
            var error = !makeDocument(true)
            if (!error) {
                // Don't allow document to be printed
                $("#print-button").prop("disabled", true)

                var blob = globalDoc.output('blob')
                var blob_url = URL.createObjectURL(blob)
                $("#document-preview").attr("src", blob_url)
                $("#document-preview").show()

                setStatus("PDF ready!", STATUS_MODE_INFO)
            }
        } catch (e) {
            console.error(e)
            $("#print-button").prop("disabled", true)
            setStatus("PDF failed to generate", STATUS_MODE_ERROR)
        }
    }, 100)
}

function generateDocument() {
    setStatus("Generating PDF...", STATUS_MODE_INFO)
    settings.customScheduleColorsCode = $("#customColorsCode").val()
    let imgsrc = document.getElementById("qrcode-gen").children[1].src
    document.getElementById("qrcode-img").src = imgsrc
    setTimeout(() => {
        try {
            var error = !makeDocument()
            if (!error) {
                // Allow document to be printed
                $("#print-button").prop("disabled", false)

                var blob = globalDoc.output('blob')
                var blob_url = URL.createObjectURL(blob)
                $("#document-preview").attr("src", blob_url)
                $("#document-preview").show()

                setStatus("PDF ready!", STATUS_MODE_INFO)
            }
        } catch (e) {
            console.error(e)
            $("#print-button").prop("disabled", true)
            setStatus("PDF failed to generate", STATUS_MODE_ERROR)
        }
    }, 100)
}


function printDocument() {
    const competitionId = wcif?.id || "Badges"
    const templateName = TEMPLATES[settings.template]?.name
        ? TEMPLATES[settings.template].name.replace(/[^a-zA-Z0-9]/g, '_')
        : "Badges"
    globalDoc.save(`${competitionId}_${templateName}.pdf`)
}


$(document).ready(function () {
    // Setup template dropdown
    let option = ''
    for (let i = 0; i < TEMPLATES.length; i++) {
        if (TEMPLATES[i].type == "badge") {
            option += '<option value="' + i + '">' + TEMPLATES[i].name + '</option>'
        }
    }
    option += '<option disabled>──────────</option>'
    for (let i = 0; i < TEMPLATES.length; i++) {
        if (TEMPLATES[i].type == "certificate") {
            option += '<option value="' + i + '">' + TEMPLATES[i].name + '</option>'
        }
    }
    for (let i = 0; i < TEMPLATES.length; i++) {
        if (TEMPLATES[i].type == "customCertificate") {
            option += '<option value="' + i + '">' + TEMPLATES[i].name + '</option>'
        }
    }

    $('#select-template').html(option)
    $('#select-template').val(String(settings.template))
    $("#template-description").text(TEMPLATES[settings.template].description)

    $(".certificate-only").hide()
    $(".custom-certificate-only").hide()

    $("#document-preview").hide()

    $("#cert-background-tint-input").colorpicker({
        color: settings.certBackgroundTint
    })
    $("#cert-page-color-input").colorpicker({
        color: settings.certPageColor
    })
    $("#cert-text-color-input").colorpicker({
        color: settings.certTextColor
    })

    useCustomColorChanged()
    $("#customColorsCode").val(`// Input variables
// event: string; the event code (e.g '333', 'pyra')
// group: number; the group number, 1 or higher. If no group, then null
// room: string; the name of the stage/room
// station: number; the station number, 1 or higher. If no station, then null
// row: number; the row number in the schedule for each day, 0 or higher
// Output variable
// color: string; a hex color to set the background of the schedule row (e.g #FFB0B0 for a light red)

// Example; alternating groups between red and green (for two different stages)
// with some events in a side room (blue)

if (event == "333mbf" || event == "444bf" || event == "555bf") {
    color = "#B0B0FF" // Side room events, blue
} else if (group % 2 == 0) {
    color = "#FFB0B0" // Even groups, red
} else {
    color = "#B0FFB0" // Odd groups, green
}`)

    qrcode = new QRCode("qrcode-gen", {
        text: settings.qrcodeLink,
        width: 512,
        height: 512,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
    })

})
