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

# save.image("D:/Stats/Kaggle/walmart/xg1.RData")
# load("xg1.RData")

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

## Creates a list for each group
# dlist1a <- aggregate(FinelineNumber ~ VisitNumber, data = select(trip, VisitNumber, FinelineNumber), FUN = I)
# dlist1a$FinelineNumber[dlist1a$VisitNumber == 7][[1]]
# table(dlist1a$FinelineNumber[dlist1a$VisitNumber == 7][[1]])




## Learning Walmart data with RTextTools -
# also http://cran.r-project.org/web/packages/irlba/index.html

library(tm)
library(RTextTools)

# returns string w/o leading or trailing whitespace
trim <- function (x) gsub("^\\s+|\\s+$", "", x)

concat <- function(scanCount, returnCount, id) {
    result <- trim(paste(c(rep(as.character(id), scanCount),
          rep(as.character(-id), returnCount)),
          collapse = " "))

    result
}

trip$Upc <- as.numeric(trip$Upc)
trip <- mutate(trip, x = concat(trip$ScanCount, trip$ReturnCount, trip$Upc))

trip <- transform(trip, x = trim(paste(c(rep(as.character(Upc), ScanCount),
                                         rep(as.character(-Upc), ReturnCount)),
                                       collapse = " ")))



trip <- mutate(trip, x = paste(  replicate(2, trip$DepartmentDescription), collapse = " "  ))

docs <- c("this is a rat", "this is another rat")
walmart <- VCorpus(VectorSource(docs))
