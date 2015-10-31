## k-nearest neigbour classification

# See https://www.youtube.com/watch?v=GtgJEVxl7DY

library(dplyr)

train <- read.csv("./input/train.csv", header = TRUE,
                  colClasses = c("factor", "factor", "factor", "factor", "integer", "factor", "factor"))

test <- read.csv("./input/test.csv", header = TRUE, 
                 colClasses = c("factor", "factor", "factor", "integer", "factor", "factor"))

## Preprocessing
train$TripType <- as.factor(train$TripType)
test <- cbind(TripType = NA, test)

dt <- rbind(train, test)

# Feature engineering 
# Include ReturnCount column
train$ReturnCount <- -train$ScanCount
train$ReturnCount[train$ReturnCount < 0] <- 0
train$ScanCount[train$ScanCount < 0] <- 0

test$ReturnCount <- -test$ScanCount
test$ReturnCount[test$ReturnCount < 0] <- 0
test$ScanCount[test$ScanCount < 0] <- 0

# rescale numeric fratures
train2 <- aggregate(cbind(ScanCount, ReturnCount) ~ VisitNumber + TripType + Weekday, data = train, FUN = sum)
train2$logScanCount <- log1p(train2$ScanCount)
train2$logReturnCount <- log1p(train2$ReturnCount)

test2 <- aggregate(cbind(ScanCount, ReturnCount) ~ VisitNumber + TripType + Weekday, data = train, FUN = sum)
test2$logScanCount <- log1p(test2$ScanCount)
test2$logReturnCount <- log1p(test2$ReturnCount)

## knn classification
library(knncat)

train2$VisitNumber <- NULL
train2$ScanCount <- NULL
train2$ReturnCount <- NULL

test2$VisitNumber <- NULL
test2$ScanCount <- NULL
test2$ReturnCount <- NULL



