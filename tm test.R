## xgboost classification

# See https://www.kaggle.com/tqchen/otto-group-product-classification-challenge/understanding-xgboost-model-on-otto-data/code

# names(train)
# [1] "TripType"              "VisitNumber"           "Weekday"
# [4] "Upc"                   "ScanCount"             "DepartmentDescription"
# [7] "FinelineNumber"

library(dplyr)
library(magrittr)
library(reshape2)
library(xgboost)
library(Matrix)
library(Ckmeans.1d.dp)
library(DiagrammeR)
library(caret)
library(corrplot)
library(Rtsne)
library(stats)
library(ggplot2)
library(e1071)
library(data.table)

# also look into slam package for sparse matricies

time.start <- Sys.time()

# Read files
train.data <- read.csv("./input/train.csv", header = TRUE, stringsAsFactors = TRUE) %>% data.table()
test.data <- read.csv("./input/test.csv", header = TRUE, stringsAsFactors = TRUE) %>% data.table()

# train.data <- top_n(train.data, 1000)
# test.data <- top_n(test.data, 1000)

# Combine train and test
trip <- data.table(rbind(train.data, cbind(TripType = -1, test.data)))

## Preprocessing
# Convert NA values
# NA values are found in FinelineNumber and Upc. "NULL" string value is found in DepartmentDescription.
trip$FinelineNumber[is.na(trip$FinelineNumber)] <- 0
trip$Upc[is.na(trip$Upc)] <- 0
trip <- trip[, NullDescription:=ifelse(trip$DepartmentDescription == "NULL", 1, 0)]
trip <- trip[, NAFinelineNumber:= ifelse(trip$FinelineNumber == 0, 1, 0)]
trip <- trip[, NAUpc:= ifelse(trip$Upc == 0, 1, 0)]

## Feature engineering
# Include ReturnCount column
trip$ReturnCount <- -trip$ScanCount
trip$ReturnCount[trip$ReturnCount < 0] <- 0
trip$ScanCount[trip$ScanCount < 0] <- 0
trip$ResultCount <- trip$ScanCount - trip$ReturnCount

# Calculate Scan and Return counts by VisitNumber
item.counts <- summarise(group_by(trip, VisitNumber),
                         TotalScan = sum(ScanCount), TotalReturn = sum(ReturnCount), TotalResult = sum(ResultCount))

# Convert trip data.frame from long to wide format using dcast from reshape2 package
# We want to aggregate on columns "TripType", "VisitNumber" and "Weekday"
trip.long <- melt.data.table(data = trip, measure.vars = c("ScanCount", "ReturnCount", "ResultCount"),
                             variable.name = "ItemCount")

trip.wide <- dcast.data.table(data = trip.long,
                              VisitNumber + TripType + Weekday ~ DepartmentDescription + ItemCount,
                              value.var = "value",
                              fun.aggregate = sum) # %>% arrange(VisitNumber)

wd <- model.matrix(~0 + Weekday, data = trip.wide)

trip.wide <- cbind(wd, trip.wide)
trip.wide <- trip.wide[, Weekday:=NULL]

trip.wide <- merge(trip.wide, item.counts, by = "VisitNumber")

# save.image("D:/Stats/Kaggle/walmart/xg1.RData")

## Creates a list for each group
# dlist1a <- aggregate(FinelineNumber ~ VisitNumber, data = select(trip, VisitNumber, FinelineNumber), FUN = I)
# dlist1a$FinelineNumber[dlist1a$VisitNumber == 7][[1]]
# table(dlist1a$FinelineNumber[dlist1a$VisitNumber == 7][[1]])


## Learning Walmart data with RTextTools -
# also http://cran.r-project.org/web/packages/irlba/index.html

library(tm)
library(RTextTools)
library(stringi)

# returns string w/o leading or trailing whitespace
trim <- function (x) gsub("^\\s+|\\s+$", "", x)

# concatneg <- function(scanCount, returnCount, id) {
#     paste(c(rep(id, scanCount),
#           rep(paste("-", id, sep = ""), returnCount)),
#           collapse = " ")
# }

load("xg1.RData")

trip$UpcIndex <- as.factor(trip$Upc) %>% as.numeric() %>% as.character()
trip$UpcIndex <- paste0("U", trip$UpcIndex)

trip$FinelineIndex <- as.factor(trip$FinelineNumber) %>% as.numeric() %>% as.character()
trip$FinelineIndex <- paste0("F", trip$FinelineIndex)

trip$DepartmentIndex <- as.numeric(trip$DepartmentDescription) %>% as.character()
trip$DepartmentIndex <- paste0("D", trip$DepartmentIndex)

trip$NullDescriptionIndex <- ifelse(trip$NullDescription == 1, "ND", "")
trip$NAUpcIndex <- ifelse(trip$NAUpc == 1, "NU", "")
trip$NAFinelineIndex <- ifelse(trip$NAFinelineNumber == 1, "NF", "")

k <- character(length(unique(trip$VisitNumber)))

system.time(
    for (i in 1:nrow(trip)) {
        if (k[trip$VisitNumber[i]] == "") {
            k[trip$VisitNumber[i]] <- trip$Weekday[i]
        }

        if (trip$ResultCount[i] > 0) {
            k[trip$VisitNumber[i]] <- paste(k[trip$VisitNumber[i]],
                                            paste(rep(paste(trip$UpcIndex[i],
                                                              trip$FinelineIndex[i],
                                                              trip$DepartmentDescriptionIndex[i],
                                                              trip$NullDescriptionIndex[i],
                                                              trip$NAUpcIndex[i],
                                                              trip$NAFinelineIndex[i]),
                                                              # trip$ResultCount[i])), collapse = " ")
                                                        1)), collapse = " ")
        }
    }
)

walmart <- VCorpus(VectorSource(k))

